# JADS (Just A Download Server)

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/ademmoe/jads?style=for-the-badge)](https://github.com/ademmoe/jads/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/ademmoe/jads?style=for-the-badge)](https://github.com/ademmoe/jads/network)
[![GitHub issues](https://img.shields.io/github/issues/ademmoe/jads?style=for-the-badge)](https://github.com/ademmoe/jads/issues)
[![GitHub license](https://img.shields.io/github/license/ademmoe/jads?style=for-the-badge)](LICENSE)

**A simple, self-hosted download server with a secure administration dashboard for managing file mirrors.**


</div>

## 📖 Overview

`JADS` (Just A Download Server) is a straightforward, self-hosted solution designed for managing file mirrors and serving downloads. It provides a clean, secure backend dashboard for administrators to upload and manage files, without exposing a public-facing upload interface. This project is ideal for individuals or organizations needing a dedicated, easy-to-deploy server to host files for download, with a focus on simplicity and control.

## ✨ Features

- 🎯 **Secure File Uploads:** Administrators can securely upload files via a dedicated dashboard.
- ⬇️ **Public File Downloads:** Serve hosted files to users for direct download.
- 📊 **Admin Dashboard:** A user-friendly web interface for managing uploaded files.
- 🔑 **Administrator Authentication:** Secure login system to protect the dashboard and upload functionalities.
- 💾 **SQLite Database:** Lightweight and easy-to-set-up database for storing file metadata and user information.
- ⚡ **Lightweight & Efficient:** Built with Node.js and Express.js for fast performance.

## 🛠️ Tech Stack

**Backend:**
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
- EJS (Embedded JavaScript Templating)
- Multer (for file uploads)
- `bcrypt` (for password hashing)
- `dotenv` (for environment variables)
- `express-session` (for session management)

**Database:**
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/index.html)

## 🚀 Quick Start

### Prerequisites
Before you begin, ensure you have the following installed:
- Node.js (v18.x or higher recommended)
- npm (Node Package Manager, usually comes with Node.js)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/ademmoe/jads.git
    cd jads
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Database setup**
    The application uses SQLite, which is file-based. The database file (`database.sqlite`) will be automatically created in the root directory on the first run.

4.  **Start server**
    ```bash
    npm start
    ```

5.  **Open your browser**
    -   **Admin Dashboard:** Visit `http://localhost:[YOUR_PORT]/dashboard` (e.g., `http://localhost:3000/dashboard`)
    -   **Public Download Page:** Visit `http://localhost:[YOUR_PORT]/` (e.g., `http://localhost:3000/`)
  
6.  **Run the setup**
    Visit the Admin Dashboard. There, you will find the initial setup screen. Specify the domain name (possibly with the port) and create the initial admin user. After that, the configuration is completed and you can use JADS.

## 📁 Project Structure


```bash
jads/
├── .gitignore          # Specifies intentionally untracked files to ignore
├── LICENSE             # Project license (MIT)
├── database.js         # Handles SQLite database connection and operations
├── index.js            # Main application entry point, server setup, routes, and logic
├── package-lock.json   # Records the exact dependency tree
├── package.json        # Project metadata and dependencies
├── uploads/            # Directory where all uploaded files are stored
└── views/              # Contains EJS template files for rendering the UI
    ├── dashboard.ejs   # Admin dashboard template
    ├── layout.ejs      # Base layout for EJS views
    └── login.ejs       # Login page template
    └── index.ejs       # Public download page template
```


## ⚙️ Configuration

JADS provides a quick-start setup where the configuration occurs manually.

## 🔧 Development

### Available Scripts
| Command     | Description                             |
|-------------|-----------------------------------------|
| `npm start` | Starts the Node.js application server.  |

The `npm start` command essentially runs `node index.js`.

### Development Workflow
Simply run `npm start` to get the server up and running. Any changes to `index.js`, `database.js`, or `views/*.ejs` will require a server restart to take effect. For continuous development, consider using `nodemon`.

## 🧪 Testing

This project does not include a dedicated testing suite or framework. Testing is primarily manual by interacting with the application via browser.

## 🚀 Deployment

To deploy `JADS` to a production environment:

1.  **Build (if any):** This project does not require a specific build step; it runs directly with Node.js.
2.  **Run:** Use a process manager like PM2 or Systemd to keep the `npm start` process running in the background and to handle restarts.
    ```bash
    # Example using PM2 (install globally: npm install -g pm2)
    pm2 start index.js --name jads
    pm2 save
    ```
3.  **Persistent Storage:** Ensure the `uploads/` directory and `database.sqlite` file are persisted across deployments or server restarts.
4.  **Reverse Proxy:** For production, it is highly recommended to use a reverse proxy like Nginx or Apache in front of `jads` for SSL termination, load balancing, and static file serving.

## 📚 API Reference

`JADS` provides a simple set of routes for its functionality.

### Authentication
The admin dashboard and upload functionality are protected by a session-based authentication system. Login is required to access `/dashboard` and `/upload` endpoints.

### Endpoints

| Method | Endpoint               | Description                                | Protected |
|--------|------------------------|--------------------------------------------|-----------|
| `GET`  | `/`                    | Displays the public download page          | No        |
| `GET`  | `/login`               | Displays the admin login page              | YES       |
| `POST` | `/login`               | Authenticates an admin user                | YES       |
| `GET`  | `/dashboard`           | Displays the admin dashboard (file list)   | Yes       |
| `POST` | `/upload`              | Handles file uploads to the server         | Yes       |
| `GET`  | `/files/:filename`     | Serves a specific file for download        | No        |
| `POST` | `/logout`              | Logs out the current admin session         | Yes       |
| `POST` | `/api/delete/:filename`| Deletes a specific file from the server    | Yes       |

## 🤝 Contributing

We welcome contributions to `JADS`! If you'd like to contribute, please follow these steps:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'feat: Add new feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a Pull Request.

### Development Setup for Contributors
The development setup is identical to the "Quick Start" guide. Ensure your `.env` file is properly configured.

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

-   **Node.js**: For providing a powerful JavaScript runtime.
-   **Express.js**: For making web application development in Node.js simple and robust.
-   **EJS**: For elegant templating.
-   **Multer**: For simplifying file uploads.
-   **SQLite**: For a lightweight and serverless database solution.
-   **`bcrypt`**: For secure password hashing.
-   **`dotenv`**: For managing environment variables.
-   **`express-session`**: For session management.

## 📞 Support & Contact

-   🐛 Issues: Feel free to report bugs or suggest features on [GitHub Issues](https://github.com/ademmoe/jads/issues).
---

<div align="center">

**⭐ Star this repo if you find it helpful!**

Made with ❤️ by [Adem Karagöz](https://github.com/ademmoe)

</div>
