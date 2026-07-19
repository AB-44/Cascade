<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncTemplatesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'templates' => ['present', 'array'],
            'templates.*.id' => ['required', 'string'],
            'templates.*.name' => ['required', 'string', 'max:255'],
            'templates.*.nodes' => ['array'],
        ];
    }
}
