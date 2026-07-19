<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Creates the single account you'll log in with from the Cascade app.
     * Change the email/password (or just update them later from tinker).
     */
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'abdull191940@gmail.com'],
            [
                'name' => 'Abdullah',
                'password' => 'aass12345', // hashed automatically via the `hashed` cast
            ]
        );
    }
}
