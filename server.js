const app = require("./app");
const serverless = require("serverless-http");

// app.listen(
//   process.env.PORT || 5000, 
//   () => console.log(`server starting on port ${process.env.PORT || 5000}!`)
// );

module.exports.server = serverless(app);