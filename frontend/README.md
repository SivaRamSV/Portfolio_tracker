# Portfolio Tracker Frontend

This is the frontend for the Portfolio Tracker application, a web-based tool designed to help you track and visualize your investment portfolio performance.

## Features

- **Portfolio Dashboard**: View an overview of your entire investment portfolio
- **Asset Visualization**: Interactive charts and graphs showing asset allocation and performance
- **Real-time Updates**: Connect to the backend API for up-to-date portfolio information
- **Responsive Design**: Built with a mobile-first approach using React and Tailwind CSS

## Tech Stack

- React 19
- Tailwind CSS
- Chart.js with react-chartjs-2 for data visualization
- Docker for containerization

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the frontend directory:
   ```bash
   cd Portfolio_tracker/frontend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Development

To start the development server:

```bash
npm start
```

This will run the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### Building for Production

To build the app for production:

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## Docker Support

The frontend includes Docker support for easy deployment. To build and run the frontend container:

```bash
# Build the Docker image
docker build -t portfolio-tracker-frontend .

# Run the container
docker run -p 80:80 portfolio-tracker-frontend
```

The frontend will be available at [http://localhost](http://localhost).

## Integration with Backend

This frontend is designed to work with the Portfolio Tracker backend API. Make sure the backend server is running for full functionality.

## Customization

- The UI is built with Tailwind CSS, which can be customized via the `tailwind.config.js` file
- Chart appearance can be modified in the relevant components

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the terms included in the repository's LICENSE file.
