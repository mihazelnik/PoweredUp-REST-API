const Koa = require("koa");
const KoaRouter = require("koa-router");
const json = require("koa-json");
const bodyParser = require("koa-bodyparser");
const PoweredUP = require("node-poweredup");

const app = new Koa();
const router = new KoaRouter();
const poweredUP = new PoweredUP.PoweredUP();

app.use(json());
app.use(bodyParser());

const COLORS = {
  black: 0,
  pink: 1,
  purple: 2,
  blue: 3,
  "light-blue": 4,
  cyan: 5,
  green: 6,
  yellow: 7,
  orange: 8,
  red: 9,
  white: 10
};

const HUBTYPES = {
  0: "Unknown",
  1: "WeDo2 Smart Hub",
  2: "Boost Move Hub",
  3: "Powered Up Hub",
  4: "Powered Up Remote",
  5: "Duplo Train Hub"
};

const DEVICETYPES = {
  0: "Unknown",
  1: "Basic Motor",
  2: "Train Motor",
  8: "Led Lights",
  22: "Boost Led",
  34: "WeDo2 Tilt",
  35: "WeDo2 Distance",
  37: "Boost Distance",
  38: "Boost Tacho Motor",
  39: "Boost Move Hub Motor",
  40: "Boost Tilt",
  41: "Duplo Train Base Motor",
  42: "Duplo Train Base Speaker",
  43: "Duplo Train Base Color",
  44: "Duplo Train Base Speedmeter",
  55: "Powered Up Remote Button"
};

const PORTS = ["A", "B"];

console.log("Looking for Hubs...");
poweredUP.scan();
poweredUP.on("discover", async hub => {
  await hub.connect();
  console.log(`Connected to ${hub.uuid}!`);
  hub.on("disconnect", () => {
    console.log(`Hub ${hub.uuid} disconnected`);
  });
});

router.get("/hubs/", hubs);

function hubInfo(hub) {
  const { uuid, batteryLevel, current, name, rssi } = hub;
  const hubTypeId = hub.getHubType();
  const hubType = { name: HUBTYPES[hubTypeId], id: hubTypeId };
  let ports = [];
  PORTS.forEach(port => {
    const deviceType = hub.getPortDeviceType(port);
    ports.push({ port: port, name: DEVICETYPES[deviceType], id: deviceType });
  });
  const data = {
    uuid,
    batteryLevel,
    current,
    name,
    rssi,
    hubType,
    ports
  };
  return data;
}

async function hubs(ctx) {
  const connectedHubs = poweredUP.getConnectedHubs();
  let hubs = [];
  connectedHubs.forEach(hub => {
    hubs.push(hubInfo(hub));
  });
  ctx.body = { hubs: hubs };
  await ctx;
}

router.get("/hubs/:uuid/", hub);

async function hub(ctx) {
  const { uuid } = ctx.params;
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");

  ctx.body = hubInfo(hub);
  await ctx;
}

router.get("/hubs/:uuid/:port/speed/:speed", speedControl);

async function speedControl(ctx) {
  const { uuid, port, speed } = ctx.params;
  const { time } = ctx.query;
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  const deviceType = hub.getPortDeviceType(port);
  ctx.assert(deviceType === 2, 422, "Motor not found on this port");
  hub.setMotorSpeed(port, speed, parseInt(time));
  ctx.body = { uuid, port, speed, time };
  await ctx;
}

router.get("/hubs/:uuid/:port/rampspeed/:fromSpeed/:toSpeed/:time",
  rampSpeedControl
);

async function rampSpeedControl(ctx) {
  const { uuid, port, fromSpeed, toSpeed, time } = ctx.params;
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  const deviceType = hub.getPortDeviceType(port);
  ctx.assert(deviceType === 2, 422, "Motor not found on this port");
  hub.rampMotorSpeed(port, fromSpeed, toSpeed, parseInt(time));
  ctx.body = { uuid, port, fromSpeed, toSpeed, time };
  await ctx;
}

router.get("/hubs/:uuid/:port/stop", motorStop);

async function motorStop(ctx) {
  const { uuid, port } = ctx.params;
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  const deviceType = hub.getPortDeviceType(port);
  ctx.assert(deviceType === 2, 422, "Motor not found on this port");
  hub.hardStopMotor(port);
  ctx.body = { uuid, port };
  await ctx;
}

router.get("/hubs/:uuid/colors/:color/", LEDcolorChange);

async function LEDcolorChange(ctx) {
  const { uuid, color } = ctx.params;
  const colorValue = COLORS[color];
  ctx.assert(colorValue, 422, "Wrong color!");
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  hub.setLEDColor(colorValue);
  ctx.body = { hub_uuid: uuid, color_value: colorValue };
  await ctx;
}

app.use(router.routes()).use(router.allowedMethods());
app.listen(3000, () => console.log("Server started..."));