module.exports = {
  apps : [{
    name: "coinScraper",
    script: "./scrapegecko.js",
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    }
  }]
}