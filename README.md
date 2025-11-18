# Leetify Steam Stats Lookup

The app lets you deploy a lightweight React frontend to GitHub Pages (or any static host) and instantly
load CS player stats from the Leetify API simply by visiting `https://<your-domain>/<steamId>`. The Steam ID is
read from the path segment, so each player can have their own shareable URL without configuring routes.

## What the page shows

* Privacy mode, win rate, match volume, and first-tracked date so you can quickly verify how long an account has existed.
* A cheat radar that now leads the page with a "sus-meter" progress bar on every heuristic so the spiciest stats surface first.
* Ban summary badges that reinforce the radar signals plus an expandable mechanical breakdown for precise aim/utility stats.
* Leetify skill ratings, CS2 Premier/Faceit/Wingman ranks, and a per-map table for competitive ranks.
* Raw mechanical/utility stats (flash effectiveness, opening duels, trading success, etc.) that can stay collapsed until you
  click "Show breakdown," plus the raw API payload for deep dives.

## Configuration

1. The app now points to Leetify's public profile endpoint (`https://api-public.cs-prod.leetify.com/v3/profile`) and
   automatically appends the `steam64_id` query string, so **no API key is required**. If you proxy through your own service or
   need to customize the request, create a `.env` file (or configure your deployment secrets) with the following optional value:

   ```bash
   REACT_APP_LEETIFY_API_URL=https://api-public.cs-prod.leetify.com/v3/profile?steam64_id={steamId}
   ```

   The `{steamId}` placeholder will be replaced automatically. If you omit it, the app will append `?steam64_id=` (or `&steam64_id=`
   if a query string already exists) to the provided URL. You can still supply `REACT_APP_LEETIFY_API_KEY` if your endpoint requires
   one, but it is not needed for the default public API.

2. Run `npm run build` and deploy the `build` folder to GitHub Pages.
3. Share URLs like `https://example.com/76561198000000000` to dynamically fetch stats for that Steam account.

---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
