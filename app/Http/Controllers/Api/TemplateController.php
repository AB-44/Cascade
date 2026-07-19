<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SyncTemplatesRequest;
use App\Models\GoalTemplate;
use Illuminate\Support\Facades\DB;

class TemplateController extends Controller
{
    public function sync(SyncTemplatesRequest $request)
    {
        $user = $request->user();
        $incoming = collect($request->validated()['templates']);

        DB::transaction(function () use ($user, $incoming) {
            $incomingIds = $incoming->pluck('id')->all();
            $user->templates()->whereNotIn('id', $incomingIds ?: ['__none__'])->delete();

            foreach ($incoming as $tpl) {
                GoalTemplate::updateOrCreate(
                    ['id' => $tpl['id'], 'user_id' => $user->id],
                    [
                        'name' => $tpl['name'],
                        'nodes' => $tpl['nodes'] ?? [],
                    ]
                );
            }
        });

        return response()->json(['message' => 'تمت المزامنة']);
    }
}
