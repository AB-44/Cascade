<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncTeamMembersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'members' => ['present', 'array'],
            'members.*.id' => ['required', 'string'],
            'members.*.name' => ['required', 'string', 'max:255'],
            'members.*.role' => ['nullable', 'string'],
            'members.*.email' => ['nullable', 'string'],
            'members.*.avatar' => ['nullable', 'string'],
            'members.*.color' => ['nullable', 'string'],
        ];
    }
}
