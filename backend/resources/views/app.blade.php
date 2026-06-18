<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>{{ config('app.name', 'LNU-HiRe') }}</title>
        @viteReactRefresh
        @vite(['resources/js/react/main.jsx'])
    </head>
    <body>
        <div id="root"></div>
    </body>
</html>
