<?php
// Форма «Обратная связь» → сообщение в Telegram.
// Работает только на Бегете (на GitHub Pages PHP нет — форма там предлагает написать в Telegram).
//
// Токен бота и chat_id лежат ВНЕ папки сайта, в файле emilius-telegram.php уровнем выше
// корня сайта (на Бегете: ~/emilius.agency/emilius-telegram.php рядом с public_html):
//
//   <?php return ['token' => '123456:ABC…', 'chat_id' => '-100…'];
//
// Как получить значения — README.md, раздел «Форма обратной связи».

declare(strict_types=1);

const MAX_MESSAGE = 3000;
const MAX_CONTACT = 200;
const RATE_LIMIT = 5;       // заявок
const RATE_WINDOW = 600;    // за 10 минут с одного адреса

$wantsJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');

function reply(int $status, array $body): never
{
    global $wantsJson;
    if ($wantsJson) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($body, JSON_UNESCAPED_UNICODE);
    } else {
        // Без JavaScript форма уходит обычным POST — возвращаем человека на главную.
        header('Location: /?sent=' . ($body['ok'] ? '1' : '0') . '#feedback', true, 303);
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    reply(405, ['ok' => false, 'error' => 'method']);
}

// Принимаем заявки только со своего сайта.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== ($_SERVER['HTTP_HOST'] ?? '')) {
    reply(403, ['ok' => false, 'error' => 'origin']);
}

// Ловушка для ботов: невидимое поле, человек его не заполняет.
if (trim((string)($_POST['website'] ?? '')) !== '') {
    reply(200, ['ok' => true]);
}

$clean = static function (string $s, int $max): string {
    $s = str_replace("\r\n", "\n", $s);
    $s = preg_replace('/[^\P{C}\n\t]/u', '', $s) ?? '';
    return trim(mb_substr($s, 0, $max));
};
$message = $clean((string)($_POST['message'] ?? ''), MAX_MESSAGE);
$contact = $clean((string)($_POST['contact'] ?? ''), MAX_CONTACT);

if ($message === '') {
    reply(422, ['ok' => false, 'error' => 'empty']);
}

// Простое ограничение частоты: отметки времени по хешу адреса во временной папке.
$ipKey = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . __FILE__);
$rateFile = sys_get_temp_dir() . '/emilius-lead-' . substr($ipKey, 0, 32);
$now = time();
$hits = array_filter(
    array_map('intval', @file($rateFile, FILE_IGNORE_NEW_LINES) ?: []),
    static fn(int $t) => $t > $now - RATE_WINDOW
);
if (count($hits) >= RATE_LIMIT) {
    reply(429, ['ok' => false, 'error' => 'rate']);
}
$hits[] = $now;
@file_put_contents($rateFile, implode("\n", $hits), LOCK_EX);

$configFile = dirname((string)($_SERVER['DOCUMENT_ROOT'] ?? __DIR__)) . '/emilius-telegram.php';
$config = is_file($configFile) ? include $configFile : null;
if (!is_array($config) || empty($config['token']) || empty($config['chat_id'])) {
    error_log('lead.php: нет настроек Telegram в ' . $configFile);
    reply(500, ['ok' => false, 'error' => 'config']);
}

$page = $clean((string)($_SERVER['HTTP_REFERER'] ?? ''), 300);
$text = "✉️ Обратная связь с сайта\n\n"
    . $message . "\n\n"
    . '👤 ' . ($contact !== '' ? $contact : 'контакт не оставили')
    . ($page !== '' ? "\n🔗 " . $page : '');

$ch = curl_init('https://api.telegram.org/bot' . $config['token'] . '/sendMessage');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query([
        'chat_id' => $config['chat_id'],
        'text' => $text,
        'disable_web_page_preview' => 'true',
    ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
]);
$response = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$sent = $status === 200 && is_string($response) && (json_decode($response, true)['ok'] ?? false);
if (!$sent) {
    error_log('lead.php: Telegram ответил ' . $status . ' ' . (is_string($response) ? $response : ''));
    reply(502, ['ok' => false, 'error' => 'telegram']);
}

reply(200, ['ok' => true]);
