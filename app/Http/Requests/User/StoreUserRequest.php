<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Access to every /users route is enforced by the "admin" middleware on the
     * route group, which redirects guests to login and 403s non-administrators.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array|string>
     */
    public function rules(): array
    {
        return [
            'photo' => ['nullable', 'image', 'file', 'max:1024'],
            'name' => ['required', 'string', 'max:50'],
            'email' => ['required', 'email', 'max:50', 'unique:users,email'],
            'username' => ['required', 'min:4', 'max:25', 'alpha_dash:ascii', 'unique:users,username'],

            // Required, must match password_confirmation, and must satisfy
            // Laravel's default password rules.
            //
            // The previous rules were 'required_with:password_confirmation' plus
            // a separate 'same:password' on the confirmation field, so omitting
            // BOTH fields passed validation and then hit the NOT NULL password
            // column. 'confirmed' checks password_confirmation without letting
            // that field reach the model.
            'password' => ['required', 'confirmed', Password::defaults()],
        ];
    }
}
