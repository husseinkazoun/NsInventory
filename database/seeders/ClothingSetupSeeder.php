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

        if (! $email || ! $password) {
            return;
        }

        // This seeder runs on every deployment. It must only ever BOOTSTRAP the
        // initial account: if one already exists for this address, leave it
        // completely alone. The previous updateOrCreate overwrote that user's
        // password, name and username with the deployment secrets on every
        // release, silently undoing any password the owner had set (existing
        // sessions kept working, so it went unnoticed until the next sign-in).
        if (User::where('email', $email)->exists()) {
            return;
        }

        $user = User::create([
            'name' => env('ADMIN_NAME', 'Sanad Inventory'),
            'username' => env('ADMIN_USERNAME', 'sanad-inventory'),
            'email' => $email,
            'password' => Hash::make($password),
        ]);

        // email_verified_at is not mass assignable, so set it explicitly on the
        // freshly created account. is_admin is intentionally left at its default
        // (false): administrator rights are granted deliberately, never by a
        // deployment.
        $user->forceFill(['email_verified_at' => now()])->save();
    }
}
