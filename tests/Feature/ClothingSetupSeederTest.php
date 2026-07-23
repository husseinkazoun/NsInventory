<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\ClothingSetupSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * The setup seeder runs on every deployment, so it must only bootstrap the
 * initial administrator account and never touch one that already exists.
 */
class ClothingSetupSeederTest extends TestCase
{
    use RefreshDatabase;

    private const EMAIL = 'owner@example.com';
    private const PASSWORD = 'deployment-secret-password';

    /** @var array<string, string|false> */
    private array $originalEnv = [];

    private function setEnv(array $values): void
    {
        foreach ($values as $key => $value) {
            if (! array_key_exists($key, $this->originalEnv)) {
                $this->originalEnv[$key] = getenv($key);
            }

            if ($value === null) {
                putenv($key);
                unset($_ENV[$key], $_SERVER[$key]);
                continue;
            }

            putenv("$key=$value");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }

    protected function tearDown(): void
    {
        foreach ($this->originalEnv as $key => $value) {
            if ($value === false) {
                putenv($key);
                unset($_ENV[$key], $_SERVER[$key]);
            } else {
                putenv("$key=$value");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }

        $this->originalEnv = [];

        parent::tearDown();
    }

    private function configureAdminEnv(): void
    {
        $this->setEnv([
            'ADMIN_EMAIL' => self::EMAIL,
            'ADMIN_PASSWORD' => self::PASSWORD,
            'ADMIN_NAME' => 'Deployment Name',
            'ADMIN_USERNAME' => 'deployment-username',
        ]);
    }

    public function test_an_existing_account_is_left_completely_unchanged(): void
    {
        $this->configureAdminEnv();

        $existing = User::factory()->create([
            'email' => self::EMAIL,
            'name' => 'Owner Chosen Name',
            'username' => 'owner-chosen',
            'password' => Hash::make('the-password-the-owner-set'),
            'email_verified_at' => null,
        ]);
        $existing->forceFill(['is_admin' => true])->save();

        $this->seed(ClothingSetupSeeder::class);

        $after = $existing->fresh();

        // Password, profile fields, verification state and admin flag all intact.
        $this->assertTrue(Hash::check('the-password-the-owner-set', $after->password));
        $this->assertFalse(Hash::check(self::PASSWORD, $after->password));
        $this->assertSame('Owner Chosen Name', $after->name);
        $this->assertSame('owner-chosen', $after->username);
        $this->assertNull($after->email_verified_at);
        $this->assertTrue($after->is_admin);
        $this->assertSame(1, User::where('email', self::EMAIL)->count());
    }

    public function test_a_missing_account_is_created_from_the_environment(): void
    {
        $this->configureAdminEnv();

        $this->assertSame(0, User::where('email', self::EMAIL)->count());

        $this->seed(ClothingSetupSeeder::class);

        $user = User::where('email', self::EMAIL)->first();

        $this->assertNotNull($user);
        $this->assertSame('Deployment Name', $user->name);
        $this->assertSame('deployment-username', $user->username);
        $this->assertTrue(Hash::check(self::PASSWORD, $user->password));
        // email_verified_at is not fillable, so it must be set explicitly.
        $this->assertNotNull($user->email_verified_at);
        // A deployment never grants administrator rights.
        $this->assertFalse($user->is_admin);
    }

    public function test_re_running_the_seeder_does_not_change_the_created_account(): void
    {
        $this->configureAdminEnv();

        $this->seed(ClothingSetupSeeder::class);
        $created = User::where('email', self::EMAIL)->first();

        // Simulate the owner changing their own credentials after the first deploy.
        $created->forceFill([
            'password' => Hash::make('changed-by-owner'),
            'name' => 'Renamed By Owner',
        ])->save();

        $this->seed(ClothingSetupSeeder::class);
        $this->seed(ClothingSetupSeeder::class);

        $after = $created->fresh();

        $this->assertTrue(Hash::check('changed-by-owner', $after->password));
        $this->assertSame('Renamed By Owner', $after->name);
        $this->assertSame(1, User::where('email', self::EMAIL)->count());
    }

    public function test_missing_configuration_creates_or_modifies_nobody(): void
    {
        $this->setEnv([
            'ADMIN_EMAIL' => null,
            'ADMIN_PASSWORD' => null,
        ]);

        $this->seed(ClothingSetupSeeder::class);

        $this->assertSame(0, User::count());
    }

    public function test_a_password_without_an_email_creates_nobody(): void
    {
        $this->setEnv([
            'ADMIN_EMAIL' => null,
            'ADMIN_PASSWORD' => self::PASSWORD,
        ]);

        $this->seed(ClothingSetupSeeder::class);

        $this->assertSame(0, User::count());
    }

    public function test_an_email_without_a_password_creates_nobody(): void
    {
        $this->setEnv([
            'ADMIN_EMAIL' => self::EMAIL,
            'ADMIN_PASSWORD' => null,
        ]);

        $this->seed(ClothingSetupSeeder::class);

        $this->assertSame(0, User::count());
    }
}
