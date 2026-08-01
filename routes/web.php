<?php

use Illuminate\Support\Facades\Route;

Route::get('/{any}', function () {
    $indexPath = public_path('build/index.html');

    if (file_exists($indexPath)) {
        return response()->file($indexPath, ['Content-Type' => 'text/html']);
    }

    abort(404, 'Frontend build not found');
})->where('any', '^(?!api).*$');
