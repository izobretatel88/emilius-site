#!/usr/bin/env python3
"""Собирает works.csv, 04-works-catalog.md, 05-packages.md и calculator.html из works.py."""
import csv, json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import works as W

BY = {x['id']: x for x in W.W}
MOD = dict(W.MODULES)

def hours(wid, qty):
    x = BY[wid]
    if x['unit']:
        return x['base'] + x['per'] * qty if (qty or x['base']) else 0
    return x['base'] * (qty or 0)

def cost(items, k=1.0):
    prod = sum(hours(i, q) * W.RATES[BY[i]['role']] for i, q in items)
    h = sum(hours(i, q) for i, q in items)
    pm = h * W.PM_SHARE; prod_pm = prod + pm * W.RATES['PM']
    total = prod_pm * k * (1 + W.RISK_BUFFER)
    return h, h + pm, total

def rnd(x, step=5000): return int(math.ceil(x / step) * step)

# CSV
cols = ['id','module','title','what','when','input','result','role','base','per','unit','level','deps','risks','variants']
with open(os.path.join(ROOT, 'works.csv'), 'w', newline='') as f:
    wr = csv.writer(f); wr.writerow(cols + ['rate'])
    for x in W.W: wr.writerow([x[c] for c in cols] + [W.RATES[x['role']]])

LV = {1: 'простая', 2: 'средняя', 3: 'сложная'}
out = ['# Каталог работ (конструктор услуги)', '',
       '> Сгенерировано из `tools/works.py` скриптом `tools/build.py`. Править там, не здесь.', '',
       'Норматив — часы исполнителя, который делал работу 3+ раза. «База» — фиксированные часы, «за ед.» — добавка за каждую единицу.',
       f'Сверху всегда: управление проектом {int(W.PM_SHARE*100)}% часов и запас на риски {int(W.RISK_BUFFER*100)}%.', '',
       '## Ставки', '', '| Роль | Кто | ₽/ч |', '|---|---|---:|']
who = {'PM':'проджект-менеджер','CFG':'настройщик / контент-менеджер','DES':'дизайнер','DEV':'разработчик InSales','SEO':'SEO / аналитик','QA':'тестировщик'}
for r, v in W.RATES.items(): out.append(f'| {r} | {who[r]} | {v:,} |'.replace(',', ' '))
for mid, mname in W.MODULES:
    items = [x for x in W.W if x['module'] == mid]
    out += ['', f'## {mid}. {mname}', '', '| ID | Работа | Что делаем | Когда нужна | От клиента | Результат | Кто | Часы | Сложн. | Зависит от | Риски / варианты |', '|---|---|---|---|---|---|---|---|---|---|---|']
    for x in items:
        h = (f"{x['base']:g}" if x['base'] else '') + (f" + {x['per']:g}/{x['unit']}" if x['unit'] else '')
        rv = '; '.join(t for t in [x['risks'], ('Варианты: ' + x['variants']) if x['variants'] else ''] if t)
        out.append(f"| {x['id']} | {x['title']} | {x['what']} | {x['when']} | {x['input']} | {x['result']} | {x['role']} | {h.strip(' +') or '0'} | {LV[x['level']]} | {x['deps']} | {rv} |")
open(os.path.join(ROOT, '04-works-catalog.md'), 'w').write('\n'.join(out) + '\n')

# Пакеты
pk = ['# Пакеты: расчёт по нормативам', '', '> Сгенерировано `tools/build.py`. Цена = часы × ставка роли + PM + запас, округление вверх до 5 000 ₽.', '']
pkjson = []
for pid, name, desc, items in W.PACKAGES:
    h, hpm, total = cost(items)
    price = rnd(total)
    pkjson.append(dict(id=pid, name=name, desc=desc, items=items, hours=round(hpm, 1), price=price))
    pk += [f'## {name} — {price:,} ₽'.replace(',', ' '), '', desc, '', f'Производственных часов: {h:.1f}, с управлением: {hpm:.1f}. Расчётная сумма до округления: {total:,.0f} ₽.'.replace(',', ' '), '',
           '| ID | Работа | Кол-во | Часы |', '|---|---|---:|---:|']
    for i, q in items:
        hh = hours(i, q)
        if hh: pk.append(f"| {i} | {BY[i]['title']} | {q if BY[i]['unit'] else ''} | {hh:.2f} |")
    pk.append('')
open(os.path.join(ROOT, '05-packages.md'), 'w').write('\n'.join(pk))

data = dict(rates=W.RATES, pm=W.PM_SHARE, risk=W.RISK_BUFFER, min=W.MIN_PROJECT,
            modules=W.MODULES, works=W.W, packages=pkjson)
tpl = open(os.path.join(HERE, 'calculator.template.html')).read()
open(os.path.join(ROOT, 'calculator.html'), 'w').write(tpl.replace('/*DATA*/null', json.dumps(data, ensure_ascii=False)))
for p in pkjson: print(p['name'], p['hours'], p['price'])
