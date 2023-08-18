const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;
const app = require('./render'); // Assuming your server code is in render.js

chai.use(chaiHttp);

describe('/render Endpoint Tests', () => {
  let server;

  before(async () => {
    server = await app.listen(4000);
  });

  after(() => {
      server.close();
  });

  it('should return an error if URL is missing', async () => {
    const res = await chai.request(server)
      .post('/render')
      .send({});

    expect(res).to.have.status(400);
    expect(res.body).to.have.property('error');
  });

  it("Gives correct response", async () => {
    const res = await chai.request(server)
      .post('/render')
      .send({
        url: "https://example.com"
        // headers: {'Accept': 'text/html; charset=utf-8; text/plain'}
    });

    expect(res).to.have.status(200);
    expect(res.text).to.contain("<h1>Example Domain</h1>")
  });


  it('should handle errors gracefully', async () => {
    const res = await chai.request(server)
      .post('/render')
      .send({
        url: 'invalid-url'
      });

    expect(res).to.have.status(500);
    expect(res.body).to.have.property('error');
  });
});
