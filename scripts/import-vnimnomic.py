"""Импорт выгрузок VnimNomic App (бывшая таблица «Заказы сводная») в обезличенные данные проекта.

    pip install openpyxl
    python3 scripts/import-vnimnomic.py "<Задачи и подсчеты>.xlsx"

Пишет docs/insales-service/data/orders-hours.csv: часы план / факт / польза по заказам.
Репозиторий публичный, поэтому в CSV нет исполнителей, денег и названий задач,
а проект заменён кодом. Соответствие кодов проектам — в data/private/projects.csv (в .gitignore).
Часы по отдельным задачам ненадёжны: время одной задачи могло трекаться в другой.
Поэтому сохраняем только суммы по заказу.
"""
import csv, datetime, hashlib, statistics, sys
from collections import defaultdict
from pathlib import Path
import openpyxl

OUT = Path(__file__).resolve().parent.parent / 'docs/insales-service/data'

def hours(v):
    if v is None: return 0.0
    if isinstance(v, datetime.timedelta): return v.total_seconds() / 3600
    if isinstance(v, datetime.time): return v.hour + v.minute / 60 + v.second / 3600
    s = str(v)
    if ':' in s:
        h, m, sec = (s.split(':') + ['0', '0'])[:3]
        try: return int(h) + int(m) / 60 + float(sec) / 3600
        except ValueError: return 0.0
    try: return float(s)
    except ValueError: return 0.0

def code(project):
    return 'P' + hashlib.sha1(project.strip().lower().encode()).hexdigest()[:4].upper()

def main(path):
    ws = openpyxl.load_workbook(path, data_only=True).active
    head = [c.value for c in ws[1]]
    ix = {name: head.index(name) for name in
          ['Задача (работа, фича, единица результата)', 'чКоманды', 'Проект', 'Заказ', '⏱️ План-час', '⏱️ Факт-час', '⏱️ Польз-час']}
    orders = defaultdict(lambda: {'tasks': 0, 'plan': 0.0, 'fact': 0.0, 'useful': 0.0, 'rates': set()})
    for r in ws.iter_rows(min_row=2, values_only=True):
        proj, order = r[ix['Проект']], r[ix['Заказ']]
        if not r[ix['Задача (работа, фича, единица результата)']] or not proj or not order or not str(order).startswith('з'):
            continue
        o = orders[(str(proj), str(order))]
        o['tasks'] += 1
        o['plan'] += hours(r[ix['⏱️ План-час']]); o['fact'] += hours(r[ix['⏱️ Факт-час']]); o['useful'] += hours(r[ix['⏱️ Польз-час']])
        if r[ix['чКоманды']]: o['rates'].add(str(r[ix['чКоманды']]))

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'private').mkdir(exist_ok=True)
    with open(OUT / 'orders-hours.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['проект', 'заказ', 'задач', 'план_ч', 'факт_ч', 'польза_ч', 'факт/план', 'ставки_команды'])
        for (proj, order), o in sorted(orders.items(), key=lambda kv: (code(kv[0][0]), kv[0][1])):
            ratio = round(o['fact'] / o['plan'], 2) if o['plan'] else ''
            w.writerow([code(proj), order, o['tasks'], round(o['plan'], 1), round(o['fact'], 1), round(o['useful'], 1), ratio, ','.join(sorted(o['rates']))])
    with open(OUT / 'private/projects.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f, delimiter=';'); w.writerow(['код', 'проект'])
        for proj in sorted({p for p, _ in orders}): w.writerow([code(proj), proj])

    ratios = [o['fact'] / o['plan'] for o in orders.values() if o['plan'] >= 5 and o['fact'] > 0]
    P = sum(o['plan'] for o in orders.values() if o['plan'] >= 5 and o['fact'] > 0)
    F = sum(o['fact'] for o in orders.values() if o['plan'] >= 5 and o['fact'] > 0)
    print(f'заказов: {len(orders)}, с планом от 5 ч: {len(ratios)}; факт/план медиана {statistics.median(ratios):.2f}, взвешенно {F / P:.2f}')

if __name__ == '__main__':
    main(sys.argv[1])
