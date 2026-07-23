<?php

namespace App\Models;

use Laravel\Sanctum\HasApiTokens;
use Illuminate\Notifications\Notifiable;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Note: 'is_admin' is deliberately absent. Keeping it out of $fillable means
     * it can never be set through mass assignment from a request, including
     * User::create($request->all()), $user->update($request->except('photo'))
     * and $user->fill($request->validated()). The flag is granted explicitly,
     * out of band.
     */
    protected $fillable = [
        'photo',
        'name',
        'username',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'is_admin' => 'boolean',
    ];

    /**
     * Whether this account holds the administrator flag.
     *
     * Phase 1 only exposes the flag; nothing in the application enforces it
     * yet, so this returning true does not currently grant any extra access.
     */
    public function isAdmin(): bool
    {
        return (bool) $this->is_admin;
    }

    public function scopeSearch($query, $value): void
    {
        $query->where('name', 'like', "%{$value}%")
            ->orWhere('email', 'like', "%{$value}%");
    }

    public function getRouteKeyName(): string
    {
        return 'username';
    }
}
