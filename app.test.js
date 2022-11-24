const request = require("supertest");
const app = require("./app");

describe("Endpoints", () => {
  test("Get /", async () => {
    const response = await request(app).get("/");
    expect(response.body.response).toEqual("Pokedex REST API");
    expect(response.statusCode).toBe(200);
  });
  test("Get /pokemon/all", async () => {
    const response = await request(app).get("/pokemon/all");
    expect(response.body.response.length > 1000).toBe(true);
    expect(response.statusCode).toBe(200);
  });
});