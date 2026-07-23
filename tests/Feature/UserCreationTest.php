<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Administrator-created accounts.
 *
 * The password must be stored as a real hash (the model has no hashed cast, so
 * the controller hashes explicitly), only validated fields may reach the model,
 * and a created account must actually be able to sign in.
 */
class UserCreationTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery';

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();

        return $admin->fresh();
    }

    /** @return array<string, string> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'New Person',
            'username' => 'new-person',
            'email' => 'new-person@example.com',
            'password' => self::PASSWORD,
            'password_confirmation' => self::PASSWORD,
        ], $overrides);
    }

    // ----------------------------------------------------------- permissions

    public function test_guests_are_redirected_from_the_creation_routes(): void
    {
        $this->get('/users/create')->assertRedirect('/login');
        $this->post('/users', $this->payload())->assertRedirect('/login');

        $this->assertSame(0, User::count());
    }

    public function test_non_admins_are_forbidden_from_the_creation_routes(): void
    {
        $regular = User::factory()->create();

        $this->actingAs($regular)->get('/users/create')->assertForbidden();
        $this->actingAs($regular)->post('/users', $this->payload())->assertForbidden();

        $this->assertNull(User::where('email', 'new-person@example.com')->first());
    }

    public function test_an_administrator_can_open_the_creation_form(): void
    {
        $this->actingAs($this->admin())->get('/users/create')->assertOk();
    }

    // ------------------------------------------------------------ validation

    public function test_the_password_is_required(): void
    {
        $payload = $this->payload();
        unset($payload['password'], $payload['password_confirmation']);

        $this->actingAs($this->admin())
            ->post('/users', $payload)
            ->assertSessionHasErrors('password');

        $this->assertNull(User::where('email', 'new-person@example.com')->first());
    }

    public function test_the_password_confirmation_is_required(): void
    {
        $payload = $this->payload();
        unset($payload['password_confirmation']);

        $this->actingAs($this->admin())
            ->post('/users', $payload)
            ->assertSessionHasErrors('password');

        $this->assertNull(User::where('email', 'new-person@example.com')->first());
    }

    public function test_a_mismatched_confirmation_creates_no_user(): void
    {
        $this->actingAs($this->admin())
            ->post('/users', $this->payload(['password_confirmation' => 'something-else']))
            ->assertSessionHasErrors('password');

        $this->assertNull(User::where('email', 'new-person@example.com')->first());
    }

    public function test_a_password_below_the_laravel_default_length_is_rejected(): void
    {
        $this->actingAs($this->admin())
            ->post('/users', $this->payload([
                'password' => 'short',
                'password_confirmation' => 'short',
            ]))
            ->assertSessionHasErrors('password');

        $this->assertNull(User::where('email', 'new-person@example.com')->first());
    }

    public function test_duplicate_emails_and_usernames_are_rejected(): void
    {
        User::factory()->create([
            'email' => 'taken@example.com',
            'username' => 'taken-name',
        ]);

        $this->actingAs($this->admin())
            ->post('/users', $this->payload(['email' => 'taken@example.com']))
            ->assertSessionHasErrors('email');

        $this->actingAs($this->admin())
            ->post('/users', $this->payload(['username' => 'taken-name']))
            ->assertSessionHasErrors('username');

        $this->assertSame(0, User::where('email', 'new-person@example.com')->count());
    }

    // ------------------------------------------------------- password storage

    public function test_the_stored_password_is_a_real_hash_and_never_the_plaintext(): void
    {
        $this->actingAs($this->admin())->post('/users', $this->payload());

        $user = User::where('email', 'new-person@example.com')->firstOrFail();

        $this->assertNotSame(self::PASSWORD, $user->password);
        $this->assertNotSame('', $user->password);

        // Recognised by Laravel as a supported hash, not an arbitrary string.
        $this->assertTrue(Hash::isHashed($user->password));
        $this->assertNotSame('unknown', Hash::info($user->password)['algoName']);
    }

    public function test_hash_check_succeeds_with_the_submitted_password(): void
    {
        $this->actingAs($this->admin())->post('/users', $this->payload());

        $user = User::where('email', 'new-person@example.com')->firstOrFail();

        $this->assertTrue(Hash::check(self::PASSWORD, $user->password));
    }

    public function test_the_created_user_can_authenticate(): void
    {
        $this->actingAs($this->admin())->post('/users', $this->payload());

        auth()->logout();

        $this->post('/login', [
            'email' => 'new-person@example.com',
            'password' => self::PASSWORD,
        ]);

        $this->assertAuthenticated();
        $this->assertSame('new-person@example.com', auth()->user()->email);
    }

    // ------------------------------------------------- mass-assignment guards

    public function test_submitted_is_admin_and_unexpected_fields_are_ignored(): void
    {
        $admin = $this->admin();

        // Note: "photo" is deliberately not abused here with a non-file value —
        // that is rejected by validation and covered by its own test.
        $this->actingAs($admin)->post('/users', $this->payload([
            'is_admin' => 1,
            'remember_token' => 'injected',
            'email_verified_at' => now()->toDateTimeString(),
        ]));

        $user = User::where('email', 'new-person@example.com')->firstOrFail();

        $this->assertFalse($user->is_admin);
        $this->assertFalse($user->isAdmin());
        // Only the administrator who performed the action remains an admin.
        $this->assertSame(1, User::where('is_admin', true)->count());
        $this->assertSame($admin->id, User::where('is_admin', true)->first()->id);
    }

    public function test_password_confirmation_is_never_stored(): void
    {
        $this->actingAs($this->admin())->post('/users', $this->payload());

        $user = User::where('email', 'new-person@example.com')->firstOrFail();

        $this->assertArrayNotHasKey('password_confirmation', $user->getAttributes());
    }

    // --------------------------------------------------------- optional photo

    public function test_a_user_can_be_created_without_a_photo(): void
    {
        $this->actingAs($this->admin())
            ->post('/users', $this->payload())
            ->assertRedirect(route('users.index'));

        $user = User::where('email', 'new-person@example.com')->firstOrFail();

        $this->assertNull($user->photo);
    }

    public function test_an_optional_photo_is_stored_and_linked(): void
    {
        Storage::fake('public');

        $this->actingAs($this->admin())->post('/users', $this->payload([
            'photo' => UploadedFile::fake()->image('avatar.jpg'),
        ]));

        $user = User::where('email', 'new-person@example.com')->firstOrFail();

        $this->assertNotNull($user->photo);
        Storage::disk('public')->assertExists('profile/'.$user->photo);
        // The photo column holds a filename, never the uploaded file object.
        $this->assertIsString($user->photo);
    }

    public function test_an_oversized_or_non_image_photo_is_rejected(): void
    {
        Storage::fake('public');

        $this->actingAs($this->admin())
            ->post('/users', $this->payload([
                'photo' => UploadedFile::fake()->create('payload.php', 20, 'text/php'),
            ]))
            ->assertSessionHasErrors('photo');

        $this->assertNull(User::where('email', 'new-person@example.com')->first());
    }
}
