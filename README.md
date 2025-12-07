# TeleCheck Pro

**TeleCheck Pro** is a modern, high-performance web application designed to validate Telegram links efficiently. Whether you have a single link or a massive list, TeleCheck Pro provides instant status verification with a premium, user-friendly interface.

## 🚀 Overview

TeleCheck Pro interacts with a robust backend API to check the validity of Telegram channel, group, and user links. It distinguishes between valid, invalid, and unknown statuses, providing detailed reasons for any issues found. The application features a sleek, responsive design with dark mode support, real-time statistics, and seamless clipboard integrations.

## ✨ Key Features

-   **Bulk Validation**: Validate multiple links simultaneously. Simply paste your list and let the tool process them in batches.
-   **Quick Check**: Instantly verify a single Telegram link.
-   **Smart Filtering**: Easily filter results to see only Valid or Invalid links.
-   **Clipboard Integration**:
    -   One-click "Paste from Clipboard" for quick input.
    -   "Copy List" to export your filtered results.
-   **Real-time Stats**: View global validation statistics (Total Checked, Valid, Invalid).
-   **Modern UI/UX**:
    -   **Glassmorphism Effects**: Premium aesthetic with blurred backgrounds and smooth gradients.
    -   **Dark/Light Mode**: Fully supported theme toggling.
    -   **Responsive Design**: Works seamlessly on desktop and mobile devices.
-   **Toast Notifications**: Instant feedback for actions like copying, pasting, and analysis completion.

## 🛠️ Tech Stack

This project is built using the latest web technologies for speed and developer experience:

-   **Framework**: [React 19](https://react.dev/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
-   **Icons**: [Lucide React](https://lucide.dev/)
-   **Notifications**: [Sonner](https://sonner.emilkowal.ski/)
-   **Deployment**: Vercel ready

## 🏁 Getting Started

Follow these steps to set up the project locally on your machine.

### Prerequisites

-   **Node.js**: Ensure you have Node.js (v18 or higher) installed.
-   **npm** or **yarn**: Package manager to install dependencies.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/saahiyo/telecheck-webui.git
    cd telecheck-webui
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the development server:**
    ```bash
    npm run dev
    ```

4.  **Open in Browser:**
    The application will be available at `http://localhost:5173` (or the port shown in your terminal).

## 📂 Project Structure

```
telecheck-webui/
├── src/
│   ├── components/      # Reusable UI components (ResultCard, StatsWidget, etc.)
│   ├── services/        # API service functions (api.ts)
│   ├── App.tsx          # Main application logic
│   ├── index.css        # Global styles and Tailwind imports
│   └── main.tsx         # Entry point
├── public/              # Static assets
├── LICENSE              # License file
└── package.json         # Dependencies and scripts
```

## 🔌 API Integration

The application connects to the **TeleCheck API** (`https://telecheck.vercel.app/`) to perform validations.

-   **GET** `/stats`: Fetches global usage statistics.
-   **GET** `/?link=...`: Validates a single link.
-   **POST** `/`: Validates a list of links in the request body.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an issue for bugs and feature requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
