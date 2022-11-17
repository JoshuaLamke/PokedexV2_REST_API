const request = require("supertest");
const app = require("./app");

describe("GET / ", () => {
  test("Should respond with rest api description", async () => {
    const response = await request(app).get("/");
    expect(response.body.response).toEqual("Pokedex REST API");
    expect(response.statusCode).toBe(200);
  });
});