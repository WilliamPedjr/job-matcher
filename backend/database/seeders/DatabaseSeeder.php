<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@lnu.local'],
            [
                'name' => 'System Admin',
                'email' => 'admin@lnu.local',
                'password' => Hash::make('password'),
                'role' => 'admin',
            ]
        );

        $this->call([
            ReferenceDataSeeder::class,
        ]);
    }
}
