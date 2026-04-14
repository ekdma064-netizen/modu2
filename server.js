const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));

const rooms = {};

io.on("connection", (socket) => {

  // 선생님: 방 만들기
  socket.on("create_room", ({ roomCode }) => {
    rooms[roomCode] = { players: {}, state: "waiting" };
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.role = "teacher";
    console.log("방 생성:", roomCode);
  });

  // 학생: 방 입장
  socket.on("join_room", ({ roomCode, name }) => {
    if (!rooms[roomCode]) {
      socket.emit("error_msg", "방을 찾을 수 없어요!");
      return;
    }
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.role = "student";
    socket.playerName = name;
    rooms[roomCode].players[socket.id] = { name, score: 0, combo: 1, count: 0 };
    io.to(roomCode).emit("players_update", rooms[roomCode].players);
    socket.emit("joined_ok");
    console.log("학생 입장:", name, roomCode);
  });

  // 선생님: 게임 시작
  socket.on("start_game", () => {
    const rc = socket.roomCode;
    if (!rooms[rc]) return;
    rooms[rc].state = "playing";
    io.to(rc).emit("game_start");
  });

  // 학생: 점수 전송
  socket.on("score_update", ({ score, combo, count }) => {
    const rc = socket.roomCode;
    if (!rooms[rc] || !rooms[rc].players[socket.id]) return;
    rooms[rc].players[socket.id].score = score;
    rooms[rc].players[socket.id].combo = combo;
    rooms[rc].players[socket.id].count = count;
    io.to(rc).emit("players_update", rooms[rc].players);
  });

  // 선생님: 게임 종료
  socket.on("end_game", () => {
    const rc = socket.roomCode;
    if (!rooms[rc]) return;
    rooms[rc].state = "ended";
    io.to(rc).emit("game_end", rooms[rc].players);
  });

  // 연결 끊김
  socket.on("disconnect", () => {
    const rc = socket.roomCode;
    if (!rc || !rooms[rc]) return;
    delete rooms[rc].players[socket.id];
    io.to(rc).emit("players_update", rooms[rc].players);
  });
});

server.listen(process.env.PORT || 3000, () => console.log("서버 실행 중"));
