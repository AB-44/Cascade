<?php

use App\Http\Controllers\Api\AssignedGoalController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\GoalController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ProjectInvitationController;
use App\Http\Controllers\Api\SharedProjectController;
use App\Http\Controllers\Api\StateController;
use App\Http\Controllers\Api\TeamMemberController;
use App\Http\Controllers\Api\TemplateController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);
    Route::put('/me/password', [AuthController::class, 'updatePassword']);

    Route::get('/state', [StateController::class, 'index']);

    Route::put('/goals', [GoalController::class, 'sync']);
    Route::put('/team-members', [TeamMemberController::class, 'sync']);
    Route::put('/projects', [ProjectController::class, 'sync']);
    Route::get('/my-projects', [ProjectController::class, 'myProjects']);
    Route::put('/templates', [TemplateController::class, 'sync']);

    // Tasks assigned to me by someone else
    Route::get('/assigned-to-me', [AssignedGoalController::class, 'index']);
    Route::patch('/assigned-to-me/{goal}', [AssignedGoalController::class, 'update']);
    Route::patch('/assigned-to-me/{goal}/checklist/{item}', [AssignedGoalController::class, 'updateChecklistItem']);

    // Inviting people to collaborate on one specific project
    Route::post('/projects/{project}/invite', [ProjectInvitationController::class, 'store']);
    Route::get('/projects/{project}/invitations', [ProjectInvitationController::class, 'indexForProject']);
    Route::delete('/projects/{project}/collaborators/{userId}', [ProjectInvitationController::class, 'destroy']);
    Route::get('/invitations', [ProjectInvitationController::class, 'indexForMe']);
    Route::post('/invitations/{invitation}/accept', [ProjectInvitationController::class, 'accept']);
    Route::post('/invitations/{invitation}/decline', [ProjectInvitationController::class, 'decline']);

    // Projects someone else invited me into
    Route::get('/shared-projects', [SharedProjectController::class, 'index']);
    Route::patch('/shared-projects/{project}/goals/{goal}', [SharedProjectController::class, 'updateGoal']);
    Route::post('/shared-projects/{project}/goals/{goal}/checklist', [SharedProjectController::class, 'storeChecklistItem']);
    Route::patch('/shared-projects/{project}/goals/{goal}/checklist/{item}', [SharedProjectController::class, 'updateChecklistItem']);
    Route::delete('/shared-projects/{project}/goals/{goal}/checklist/{item}', [SharedProjectController::class, 'destroyChecklistItem']);
});

