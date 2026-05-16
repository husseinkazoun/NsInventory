<?php

namespace App\Http\Controllers\Dashboards;

use App\Enums\OrderStatus;
use App\Enums\PurchaseStatus;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\MissingComponent;
use App\Models\Order;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Quotation;
use App\Models\ScanningSession;

class DashboardController extends Controller
{
    public function index()
    {
        $orders = Order::count();
        $completedOrders = Order::where('order_status', OrderStatus::COMPLETE)
            ->count();

        $products = Product::regularProducts()->count();

        $purchases = Purchase::count();
        $todayPurchases = Purchase::query()
            ->where('date', today())
            ->get()
            ->count();

        $categories = Category::count();

        $quotations = Quotation::count();
        $todayQuotations = Quotation::query()
            ->where('date', today()->format('Y-m-d'))
            ->get()
            ->count();

        // Sanad Smart Inventory metrics
        $labAssetsActive = Product::labAssets()
            ->where('asset_status', 'active')
            ->count();

        $labAssetsMaintenanceDue = Product::labAssets()
            ->whereNotNull('next_maintenance')
            ->where('next_maintenance', '<=', now()->addDays(7))
            ->count();

        $missingComponents = MissingComponent::where('status', 'missing')->count();

        $lowStockProducts = Product::regularProducts()
            ->whereColumn('quantity', '<=', 'quantity_alert')
            ->count();

        $pendingPurchases = Purchase::where('status', PurchaseStatus::PENDING)->count();

        $pendingOrders = Order::where('order_status', OrderStatus::PENDING)->count();

        $recentScans = ScanningSession::where('started_at', '>=', now()->subDay())->count();

        return view('dashboard', [
            'products' => $products,
            'orders' => $orders,
            'completedOrders' => $completedOrders,
            'purchases' => $purchases,
            'todayPurchases' => $todayPurchases,
            'categories' => $categories,
            'quotations' => $quotations,
            'todayQuotations' => $todayQuotations,
            'labAssetsActive' => $labAssetsActive,
            'labAssetsMaintenanceDue' => $labAssetsMaintenanceDue,
            'missingComponents' => $missingComponents,
            'lowStockProducts' => $lowStockProducts,
            'pendingPurchases' => $pendingPurchases,
            'pendingOrders' => $pendingOrders,
            'recentScans' => $recentScans,
        ]);
    }
}
