<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SyncGoalsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // gated by the auth:sanctum middleware on the route
    }

    public function rules(): array
    {
        return [
            'goals' => ['present', 'array'],
            'goals.*.id' => ['required', 'string'],
            'goals.*.parentId' => ['nullable', 'string'],
            'goals.*.roadmapOwnerId' => ['nullable', 'string'],
            'goals.*.projectId' => ['nullable', 'string'],
            'goals.*.name' => ['required', 'string', 'max:255'],
            'goals.*.requirements' => ['nullable', 'string'],
            'goals.*.notes' => ['nullable', 'string'],
            'goals.*.assignedTo' => ['nullable', 'string'],
            'goals.*.priority' => ['required', 'in:High,Medium,Low'],
            'goals.*.progress' => ['required', 'integer', 'min:0', 'max:100'],
            'goals.*.autoProgress' => ['required', 'boolean'],
            'goals.*.status' => ['required', 'in:Not Started,In Progress,Completed'],
            'goals.*.deadline' => ['nullable', 'date'],
            'goals.*.startDate' => ['nullable', 'date'],
            'goals.*.reminder' => ['boolean'],
            'goals.*.reminderAt' => ['nullable', 'date'],
            'goals.*.reminderFired' => ['boolean'],
            'goals.*.startedAt' => ['nullable', 'date'],
            'goals.*.accumulatedMs' => ['nullable', 'integer', 'min:0'],
            'goals.*.timerPaused' => ['boolean'],
            'goals.*.estimatedMs' => ['nullable', 'integer', 'min:0'],
            'goals.*.estimatedTargetFired' => ['boolean'],
            'goals.*.breakReminderFired' => ['boolean'],
            'goals.*.tag' => ['nullable', 'string'],
            'goals.*.color' => ['nullable', 'string'],
            'goals.*.dependsOn' => ['array'],
            'goals.*.dependsOn.*' => ['string'],
            'goals.*.archived' => ['boolean'],
            'goals.*.templateId' => ['nullable', 'string'],
            'goals.*.order' => ['required', 'integer'],
            'goals.*.collapsed' => ['boolean'],

            'goals.*.checklist' => ['array'],
            'goals.*.checklist.*.id' => ['required', 'string'],
            'goals.*.checklist.*.text' => ['required', 'string'],
            'goals.*.checklist.*.notes' => ['nullable', 'string'],
            'goals.*.checklist.*.done' => ['required', 'boolean'],
            'goals.*.checklist.*.images' => ['array'],
            'goals.*.checklist.*.images.*' => ['string'],
            'goals.*.checklist.*.startedAt' => ['nullable', 'date'],
            'goals.*.checklist.*.accumulatedMs' => ['nullable', 'integer', 'min:0'],
            'goals.*.checklist.*.timerPaused' => ['boolean'],

            'goals.*.timeSessions' => ['array'],
            'goals.*.timeSessions.*.id' => ['required', 'string'],
            'goals.*.timeSessions.*.start' => ['required', 'date'],
            'goals.*.timeSessions.*.end' => ['required', 'date'],
            'goals.*.timeSessions.*.durationMs' => ['required', 'integer', 'min:0'],
        ];
    }
}
