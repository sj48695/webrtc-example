import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class SignalingGateway {
  @WebSocketServer()
  server: Server;

  // 1단계 - 입장 알림
  @SubscribeMessage('join')
  async handleJoinMessage(client: Socket, roomId: any) {
    console.log('join', roomId);
    client.join(roomId);
    client.broadcast.to(roomId).emit('enter', { userId: client.id });
  }

  // 2단계 - 연결 요청
  @SubscribeMessage('offer')
  handleOfferMessage(client: Socket, { offer, roomId }) {
    console.log('client.id', client.id);
    console.log('offer', { offer, roomId });
    client.broadcast.to(roomId).emit('offer', { userId: client.id, offer });
  }

  // 3단계 - 응답 생성
  @SubscribeMessage('answer')
  handleAnswerMessage(client: Socket, { answer, toUserId, roomId }) {
    console.log('answer', { answer, toUserId, roomId });
    client.broadcast.to(roomId).emit('answer', {
      userId: client.id,
      answer,
      toUserId,
    });
  }

  // 4단계 - 연결 후보 교환
  @SubscribeMessage('candidate')
  handleCandidateMessage(client: Socket, { candidate, roomId }) {
    console.log('candidate', { candidate, roomId });
    client.broadcast
      .to(roomId)
      .emit('candidate', { userId: client.id, candidate });
  }

  // 5단계 - 연결 종료
  @SubscribeMessage('call-end')
  handleCallEndMessage(client: Socket, { roomId }) {
    console.log('call-end', { roomId });
    client.broadcast.to(roomId).emit('call-end', { userId: client.id });
  }
}
