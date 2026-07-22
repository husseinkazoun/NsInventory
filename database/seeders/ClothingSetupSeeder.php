<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ClothingSetupSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            'Tops', 'Shirts and Blouses', 'T-Shirts', 'Knitwear',
            'Jackets and Coats', 'Dresses', 'Skirts', 'Trousers',
            'Jeans', 'Shorts', 'Activewear', 'Shoes', 'Bags', 'Accessories',
        ] as $name) {
            Category::updateOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name]
            );
        }

        Unit::updateOrCreate(
            ['slug' => 'piece'],
            ['name' => 'Piece', 'short_code' => 'pc']
        );

        $email = env('ADMIN_EMAIL');
        $password = env('ADMIN_PASSWORD');

        if ($email && $password) {
            User::updateOrCreate(
                ['email' => $email],
                [
                    'name' => env('ADMIN_NAME', 'Sanad Inventory'),
                    'username' => env('ADMIN_USERNAME', 'sanad-inventory'),
                    'email_verified_at' => now(),
                    'password' => Hash::make($password),
                ]
            );
        }
    }
}
