const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
// const socket = io('http://server:3000'); // Signaling 서버 연결
const socket = io('http://localhost:3001'); // Signaling 서버 연결
// const socket = io('http://192.168.1.139:3001'); // Signaling 서버 연결

let localStream;
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let peerInfo = {};
let selectedCandidate = {};
let roomId = '1234';

// 내 비디오 & 오디오 정보를 가져옵니다.
const getMedia = async () => {
  try {
    await navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStream = stream;
        localVideo.srcObject = stream;
        console.log('localStream', localStream);

        // 로컬 스트림 녹음 시작
        startRecording(localStream);
      });
  } catch (error) {
    console.log(error);
  }
};

// PeerConnection 생성
const createPeerConnection = async (userId) => {
  peerInfo[userId] = new Object();
  peerInfo[userId].peerConnection = new RTCPeerConnection(config);
  peerInfo[userId].peerConnection.addEventListener('candidate', candidate);
  peerInfo[userId].peerConnection.addEventListener('addstream', addStream);

  for (let track of localStream?.getTracks() || []) {
    await peerInfo[userId].peerConnection.addTrack(track, localStream);
  }
};

// WebRTC Offer/Answer 및 ICE Candidate 처리
socket.on('enter', async ({ userId }) => {
  await createPeerConnection(userId);
  const offer = await peerInfo[userId].peerConnection.createOffer();
  await peerInfo[userId].peerConnection.setLocalDescription(offer);
  socket.emit('offer', { offer, roomId });
});

socket.on('offer', async ({ userId, offer }) => {
  console.log('peerInfo', peerInfo);
  if (!peerInfo[userId]) {
    await createPeerConnection(userId);
    await peerInfo[userId].peerConnection.setRemoteDescription(offer);

    const answer = await peerInfo[userId].peerConnection.createAnswer(offer);

    await peerInfo[userId].peerConnection.setLocalDescription(answer);
    socket.emit('answer', {
      answer,
      offer,
      toUserId: userId,
      roomId,
    });
  }
});

socket.on('answer', async ({ userId, answer, responseOffer, toUserId }) => {
  if (peerInfo[toUserId] === undefined) {
    await peerInfo[userId].peerConnection.setRemoteDescription(answer);
  }
});

socket.on('candidate', async ({ userId, candidate }) => {
  if (selectedCandidate[candidate.candidate] === undefined) {
    selectedCandidate[candidate.candidate] = true;
    await peerInfo[userId].peerConnection.addCandidate(candidate);
  }
});

socket.on('userDisconnect', ({ userId }) => {
  delete peerInfo[userId];
  //const disconnectUser = document.getElementById(userId);
  //disconnectUser.remove();
});

// 연결 후보 교환
const candidate = (data) => {
  if (data.candidate) socket.emit('candidate', data.candidate);
};

// MediaRecorder로 녹음 시작
const startRecording = (stream) => {
  mediaRecorder = new MediaRecorder(stream);

  // 데이터가 생성될 때마다 저장
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  // 녹음 종료 시 Blob 생성 및 저장
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    recordedChunks = []; // 녹음 데이터 초기화
    saveRecording(blob);
  };

  mediaRecorder.start(); // 녹음 시작
  console.log('Recording started');
};

// 녹음된 파일 저장
const saveRecording = (blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = 'recording.webm'; // 저장될 파일명
  document.body.appendChild(a);
  a.click();
  console.log('Recording saved');
};

// 상대 영상 & 비디오 추가
const addStream = (data) => {
  console.log('addStream', data.stream);
  let videoArea = document.createElement('video');
  videoArea.autoplay = true;
  videoArea.srcObject = data.stream;

  let container = document.getElementById('container');
  container.appendChild(videoArea);

  // 원격 스트림 녹음 시작
  startRecording(data.stream);
};

// 통화 종료 시 녹음 중지
socket.on('call-end', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop(); // 녹음 종료
    console.log('Recording stopped');
  }
});

// 통화 종료 시 클라이언트에서 'call-end' 이벤트 트리거
const endCall = () => {
  socket.emit('call-end', roomId);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
};

const share = async () => {
  socket.emit('join', roomId);
};

const useMedia = async () => {
  await getMedia();
};

share();
useMedia();
