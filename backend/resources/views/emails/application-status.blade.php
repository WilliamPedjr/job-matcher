<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{{ $subject }}</title></head>
<body style="margin:0;padding:24px;background:#f5f7fa;color:#172033;font-family:Arial,sans-serif;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #dbe3ef;border-radius:8px;">
    <p style="margin:0;color:#172b73;font-size:20px;font-weight:bold;">Leyte Normal University</p>
    <p style="margin:0 0 24px;color:#475569;">LNU-HiRe Recruitment</p>
    <p>{{ $greeting }}</p>
    @foreach ($introLines as $line)
      <p>{{ $line }}</p>
    @endforeach
    @foreach ($outroLines as $line)
      <p>{{ $line }}</p>
    @endforeach
    <p style="margin-top:24px;">{{ $salutation }}</p>
  </div>
</body>
</html>
