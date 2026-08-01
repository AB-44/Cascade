<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncProjectsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'projects' => ['present', 'array'],
            'projects.*.id' => ['required', 'string'],
            'projects.*.name' => ['required', 'string', 'max:255'],
            'projects.*.description' => ['nullable', 'string'],
            'projects.*.color' => ['nullable', 'string'],
            'projects.*.memberIds' => ['array'],
            'projects.*.memberIds.*' => ['string'],
            'projects.*.sequentialLock' => ['sometimes', 'boolean'],
            'projects.*.archived' => ['sometimes', 'boolean'],
            'projects.*.isShared' => ['sometimes', 'boolean'],
            'projects.*.image' => ['sometimes', 'nullable', 'string'],
            'projects.*.lifecycleStatus' => ['sometimes', 'string', 'in:active,paused,completed'],
            'projects.*.showOnDashboard' => ['sometimes', 'boolean'],
            'projects.*.allowNewGoals' => ['sometimes', 'boolean'],
        ];
    }
}
