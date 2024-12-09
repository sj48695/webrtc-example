const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
// const socket = io('http://server:3000'); // Signaling 서버 연결
const socket = io('http://localhost:3001'); // Signaling 서버 연결
// const socket = io('http://192.168.1.139:3001'); // Signaling 서버 연결

let localStream;
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

console.log("navigator.mediaDevices", navigator.mediaDevices)

// Local Media 초기화
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  localStream = stream;
  localVideo.srcObject = stream;
});

// WebRTC Offer/Answer 및 ICE Candidate 처리
socket.on('offer', async (offer) => {
  peerConnection = createPeerConnection();
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

socket.on('answer', (answer) => peerConnection.setRemoteDescription(answer));
socket.on('candidate', (candidate) => peerConnection.addIceCandidate(candidate));

// PeerConnection 생성
function createPeerConnection() {
  const pc = new RTCPeerConnection(config);
  if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  pc.ontrack = (event) => remoteVideo.srcObject = event.streams[0];
  pc.onicecandidate = (event) => {
    if (event.candidate) socket.emit('candidate', event.candidate);
  };
  return pc;
}

// Signaling 서버로 Offer 전송
async function call() {
  peerConnection = createPeerConnection();
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer);
}

// 자동 연결 시작
call();