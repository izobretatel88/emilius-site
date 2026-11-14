// Видеоотзыв клиента в цифрах и словах — из его же субтитров (think-different, итерации 85–86).
// Длительность и расшифровка не пишутся руками: поменяются субтитры — поменяется и текст на сайте.
// Первая реплика с «?» — вопрос интервьюера, остальное — ответ клиента.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VIDEO_REVIEW } from '../data/insales';

export function videoReview() {
  let cues: { end: number; text: string }[] = [];
  try {
    const vtt = readFileSync(join(process.cwd(), 'public', VIDEO_REVIEW.captions), 'utf8').replace(/\r/g, '');
    cues = [...vtt.matchAll(/\d\d:\d\d:\d\d\.\d+ --> (\d\d):(\d\d):(\d\d)\.\d+[^\n]*\n([\s\S]*?)(?=\n\n|\n*$)/g)]
      .map((m) => ({ end: +m[1] * 3600 + +m[2] * 60 + +m[3], text: m[4].replace(/\s+/g, ' ').trim() }));
  } catch {
    /* субтитров нет — расшифровку и длительность не показываем */
  }
  const seconds = cues.length ? cues[cues.length - 1].end : 0;
  const ask = cues[0]?.text.endsWith('?') ? cues[0].text : '';
  return {
    seconds,
    length: seconds ? `${Math.floor(seconds / 60)}\u00a0мин ${seconds % 60}\u00a0с` : '',
    ask,
    answer: cues.slice(ask ? 1 : 0).map((c) => c.text).join(' '),
    name: VIDEO_REVIEW.who.split(',')[0].trim(),
  };
}
