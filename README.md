# Enhanced Inventory Management System with Lab Assets

A comprehensive Laravel-based inventory management system that combines traditional product/donation management with advanced lab asset tracking and AI-powered photo scanning capabilities.

## 🚀 Features

### **Traditional Inventory Management**
- ✅ Product management with categories and units
- ✅ Order processing and tracking
- ✅ Purchase management and approval workflows
- ✅ Customer and supplier management
- ✅ Quotation system
- ✅ User management with roles
- ✅ Dashboard with analytics

### **Lab Assets Management (NEW)**
- 🔬 **AI-Powered Photo Scanning** - 4-step workflow for automatic device recognition
- 📱 **Mobile-Optimized Interface** - Scan assets using phone/tablet cameras
- 🤖 **OpenAI Vision Integration** - Automatic extraction of serial numbers, models, manufacturers
- 🔍 **Missing Component Detection** - AI identifies missing cables, accessories, and parts
- 📊 **Comprehensive Asset Tracking** - Location, assignment, condition, maintenance scheduling
- 📈 **Advanced Analytics** - Asset statistics, maintenance alerts, component tracking
- 🎯 **Unified System** - Seamlessly integrated with existing inventory management

## 🛠️ Technology Stack

- **Backend:** Laravel 10, PHP 8.1+
- **Frontend:** Blade Templates, Tabler UI, Bootstrap 5
- **Database:** MySQL/MariaDB
- **AI Processing:** OpenAI Vision API
- **Queue System:** Laravel Queues (Redis recommended)
- **File Storage:** Laravel Storage (local/S3 compatible)

## 📦 Installation

### **Prerequisites**
- PHP 8.1 or higher
- Composer
- Node.js & NPM
- MySQL/MariaDB
- OpenAI API Key (for photo scanning)

### **Setup Steps**

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/enhanced-inventory-system.git
cd enhanced-inventory-system
```

2. **Install dependencies**
```bash
composer install
npm install
```

3. **Environment configuration**
```bash
cp .env.example .env
php artisan key:generate
```

4. **Configure your `.env` file**
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=your_database_name
DB_USERNAME=your_username
DB_PASSWORD=your_password

# OpenAI API for photo scanning
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_BASE=https://api.openai.com/v1

# Queue configuration (recommended)
QUEUE_CONNECTION=database
```

5. **Database setup**
```bash
php artisan migrate
php artisan db:seed
```

6. **Storage setup**
```bash
php artisan storage:link
```

7. **Build assets**
```bash
npm run build
```

8. **Start the application**
```bash
php artisan serve
```

## 🎯 Usage

### **Traditional Inventory**
- Access the main dashboard at `/dashboard`
- Manage products, orders, purchases through the navigation menu
- Use existing workflows for donation/product management

### **Lab Assets**
1. **Navigate to Lab Assets** → Photo Scanning
2. **4-Step Scanning Process:**
   - **Step 1:** Device overview photo
   - **Step 2:** Serial numbers and labels
   - **Step 3:** Components and accessories
   - **Step 4:** Review AI-extracted information and save

3. **Asset Management:**
   - View all assets with search and filtering
   - Track assignments, locations, and conditions
   - Monitor missing components and maintenance schedules

## 🔧 Configuration

### **Queue Processing (Recommended)**
For better performance with photo processing:

```bash
# Create queue table
php artisan queue:table
php artisan migrate

# Run queue worker
php artisan queue:work
```

### **OpenAI API Setup**
1. Get an API key from [OpenAI](https://platform.openai.com/)
2. Add to your `.env` file: `OPENAI_API_KEY=your_key_here`
3. Ensure you have sufficient API credits for photo processing

## 📱 Mobile Usage

The photo scanning interface is optimized for mobile devices:
- Use tablets or phones for on-site asset scanning
- Camera integration for direct photo capture
- Responsive design works on all screen sizes
- Touch-friendly interface for easy navigation

## 🔒 Security

- CSRF protection on all forms
- File upload validation and restrictions
- User authentication and authorization
- Secure API endpoints with rate limiting
- Environment-based configuration

## 📊 API Endpoints

### **Lab Assets API**
```
GET    /lab-assets              # List all assets
GET    /lab-assets/dashboard    # Dashboard data
POST   /lab-assets              # Create new asset
GET    /lab-assets/{id}         # View asset details
PUT    /lab-assets/{id}         # Update asset
DELETE /lab-assets/{id}         # Delete asset
```

### **Scanning API**
```
POST   /api/scanning/start      # Start scanning session
POST   /api/scanning/upload     # Upload photo for processing
GET    /api/scanning/session/{id} # Get session status
POST   /api/scanning/session/{id}/complete # Complete session
```

## 🚀 Deployment

### **Production Deployment**
1. Set `APP_ENV=production` in `.env`
2. Configure proper database credentials
3. Set up queue workers with supervisor
4. Configure web server (Apache/Nginx)
5. Set up SSL certificates
6. Configure file storage (S3 recommended for production)

### **Docker Deployment**
```bash
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### **Common Issues**
- **Photos not processing:** Check OpenAI API key and credits
- **Camera not working:** Use file upload as alternative
- **Database errors:** Run `php artisan migrate`
- **Permission errors:** Check storage folder permissions

### **Getting Help**
- Check the [Integration Documentation](README_INTEGRATION.md)
- Review Laravel documentation for framework questions
- Check OpenAI API documentation for AI processing issues

## 🎉 Features Showcase

### **AI Photo Processing**
- Automatic device type recognition
- Serial number and model extraction
- Missing component detection with cost estimates
- Condition assessment and confidence scoring

### **Comprehensive Asset Management**
- Real-time dashboard with statistics
- Assignment tracking and history
- Maintenance scheduling and alerts
- Location and condition monitoring

### **Unified Interface**
- Seamless integration with existing inventory
- Consistent Tabler UI design
- Mobile-responsive interface
- Professional user experience

---

**Built with ❤️ for efficient inventory and lab asset management**

## 🔗 Links
- [Live Demo](https://nsd.xob-webservices.com)
- [Integration Guide](README_INTEGRATION.md)
- [Laravel Documentation](https://laravel.com/docs)
- [OpenAI API](https://platform.openai.com/docs)

