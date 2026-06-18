import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.js',
                'resources/js/react/main.jsx',
            ],
            refresh: [
                'app/**',
                'bootstrap/**',
                'config/**',
                'database/**',
                'resources/views/**',
                'routes/**',
            ],
        }),
    ],
});
