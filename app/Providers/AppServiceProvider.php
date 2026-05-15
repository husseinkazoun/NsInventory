<?php

namespace App\Providers;

use Illuminate\Http\Request;
use App\AI\VisionProvider;
use App\AI\OpenAIVisionProvider;
use App\Breadcrumbs\Breadcrumbs;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(VisionProvider::class, OpenAIVisionProvider::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Paginator::useBootstrapFive();

        Request::macro('breadcrumbs', function (){
            return new Breadcrumbs($this);
        });
    }
}
