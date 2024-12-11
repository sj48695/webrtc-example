import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JoinChannelDto } from './dto/join-channel.dto';
import { RoomService } from 'src/mediasoup/room/room.service';
import { TransportService } from 'src/mediasoup/transport/transport.service';
import { ProducerConsumerService } from 'src/mediasoup/producer-consumer/producer-consumer.service';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { types } from 'mediasoup';

@WebSocketGateway({
  cors: true,
  // cors: {
  //   origin: 'https://192.168.35.25:3001',
  //   credentials: true,
  // },
})
export class SignalingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  ffmpegProcesses: Record<string, any> = {};

  constructor(
    private readonly roomService: RoomService,
    private readonly transportService: TransportService,
    private readonly producerConsumerService: ProducerConsumerService,
  ) {}

  afterInit() {
    console.log(`Server initialized`);
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }
  async createPlainTransport(roomId: string) {
    const room = this.roomService.getRoom(roomId);
    const plainTransport = await room.router?.router?.createPlainTransport({
      listenIp: '127.0.0.1',
      rtcpMux: false,
      comedia: true,
    });

    const localPort = plainTransport.tuple.localPort;
    const remotePort = 5004; // FFmpeg가 수신할 포트

    await plainTransport.connect({
      ip: '127.0.0.1',
      port: remotePort, // FFmpeg에서 RTP 데이터를 받을 포트
    });
    console.log('plainTransport', plainTransport);
    console.log(
      `PlainTransport created:
      tuple.localPort=${plainTransport.tuple.localPort},
      rtcpTuple.localPort=${plainTransport.rtcpTuple.localPort},
      remotePort=${remotePort}`,
    );

    return plainTransport;
  }

  async startRecording(roomId: string, plainTransport, port: number = 5004) {
    const recordingsPath = path.resolve(__dirname, '../recordings');
    console.log('Recordings path:', recordingsPath);
    if (!fs.existsSync(recordingsPath)) {
      fs.mkdirSync(recordingsPath, { recursive: true });
    }

    const outputFile = path.join(recordingsPath, `${roomId}.mp4`);
    // // 빈 파일 생성
    // fs.writeFileSync(outputFile, '', 'utf8'); // 빈 문자열로 파일 생성

    if (this.ffmpegProcesses[roomId]) {
      console.log(`Recording already in progress for room ${roomId}`);
      return;
    }

    const ffmpeg = spawn('ffmpeg', [
      ...['-loglevel', 'debug'],
      ...['-protocol_whitelist', 'file,udp,rtp'],
      // ...['-buffer_size', '1000000'], // UDP 버퍼 크기 증가
      // ...['-i', `rtp://127.0.0.1:${port}`],
      ...[
        // ...[
        //   '-f',
        //   'rtp',
        //   '-i',
        //   `rtp://127.0.0.1:${plainTransport.tuple.localPort}`,
        // ],
        ...[
          '-f',
          'rtp',
          '-i',
          `rtp://127.0.0.1:${plainTransport.rtcpTuple.localPort}`,
        ],
      ],
      // ...['-acodec', 'copy'],
      // ...['-acodec', 'pcm_s16le'],
      // ...['-ar', '44100'],
      // ...['-ac', '2'],
      ...[...['-c:v', 'libx264'], ...['-preset', 'ultrafast']],
      outputFile,
    ]);

    console.log('FFmpeg command:', ffmpeg.spawnargs.join(' '));

    this.ffmpegProcesses[roomId] = ffmpeg;

    ffmpeg.stdout.on('data', (data) => console.log(`FFmpeg output: ${data}`));
    ffmpeg.stderr.on('data', (data) => console.error(`FFmpeg error: ${data}`));
    ffmpeg.on('close', (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
      delete this.ffmpegProcesses[roomId];
    });
  }

  // 녹음 종료 함수
  async stopRecording(roomId: string) {
    const recordingsPath = path.resolve(__dirname, '../recordings');
    console.log('Recordings path:', recordingsPath);
    const ffmpegProcess = this.ffmpegProcesses[roomId];

    if (ffmpegProcess) {
      ffmpegProcess.kill('SIGINT'); // SIGINT로 프로세스 종료
      delete this.ffmpegProcesses[roomId];
      console.log(`Stopped recording for room: ${roomId}`);

      // 반환할 파일 경로 (녹음 파일)
      const outputPath = path.join(recordingsPath, `${roomId}.mp4`);
      return outputPath;
    } else {
      console.warn(`No recording process found for room: ${roomId}`);
      return null;
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinChannel(
    @MessageBody() dto: JoinChannelDto,
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, peerId } = dto;

    try {
      const newRoom = await this.roomService.createRoom(roomId);
      const sendTransportOptions =
        await this.transportService.createWebRtcTransport(
          roomId,
          peerId,
          'send',
        );

      const recvTransportOptions =
        await this.transportService.createWebRtcTransport(
          roomId,
          peerId,
          'recv',
        );

      client.join(roomId); // Socket.io 룸에 참가

      // 방의 현재 참여자 목록 전송
      const room = this.roomService.getRoom(roomId);
      const peerIds = Array.from(room.peers.keys());

      // 기존 Producer들의 정보 수집
      const existingProducers = [];
      for (const [otherPeerId, peer] of room.peers) {
        if (otherPeerId !== peerId) {
          for (const producer of peer.producers.values()) {
            existingProducers.push({
              producerId: producer.producer.id,
              peerId: otherPeerId,
              kind: producer.producer.kind,
            });
          }
        }
      }

      client.emit('update-peer-list', { peerIds });

      // 다른 클라이언트들에게 새로운 유저 알림
      client.to(roomId).emit('new-peer', { peerId });

      return {
        sendTransportOptions,
        recvTransportOptions,
        rtpCapabilities: newRoom.router.router.rtpCapabilities,
        peerIds,
        existingProducers,
      };
    } catch (error) {
      console.error(error);
      client.emit('join-room-error', { error: error.message });
    }
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const rooms = Array.from(client.rooms);

    for (const roomId of rooms) {
      if (roomId !== client.id) {
        const room = this.roomService.getRoom(roomId);
        if (room) {
          const peer = room.peers.get(client.id);
          if (peer) {
            // Close all producers
            for (const producer of peer.producers.values()) {
              producer.producer.close();
            }
            // Close all consumers
            for (const consumer of peer.consumers.values()) {
              consumer.consumer.close();
            }
            // Close all transports
            for (const transport of peer.transports.values()) {
              transport.transport.close();
            }
            room.peers.delete(client.id);
          }
          client.leave(roomId);
          client.to(roomId).emit('peer-left', { peerId: client.id });
          if (room.peers.size === 0) {
            this.roomService.removeRoom(roomId);
          }
        }
      }
    }
    return { left: true };
  }

  @SubscribeMessage('connect-transport')
  async handleConnectTransport(
    @MessageBody() data,
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, peerId, dtlsParameters, transportId } = data;
    const room = this.roomService.getRoom(roomId);
    const peer = room?.peers.get(peerId);
    if (!peer) {
      return { error: 'Peer not found' };
    }
    const transportData = peer.transports.get(transportId);
    if (!transportData) {
      return { error: 'Transport not found' };
    }
    await transportData.transport.connect({ dtlsParameters });
    console.log('>> transport connected');

    return { connected: true };
  }

  @SubscribeMessage('produce')
  async handleProduce(@MessageBody() data, @ConnectedSocket() client: Socket) {
    const { roomId, peerId, kind, transportId, rtpParameters } = data;

    try {
      const producerId = await this.producerConsumerService.createProducer({
        roomId,
        peerId,
        transportId,
        kind,
        rtpParameters,
      });

      // 다른 클라이언트에게 새로운 Producer 알림
      client.to(roomId).emit('new-producer', { producerId, peerId, kind });

      return { producerId };
    } catch (error) {
      console.error(error);
      client.emit('produce-error', { error: error.message });
    }
  }

  @SubscribeMessage('consume')
  async handleConsume(@MessageBody() data, @ConnectedSocket() client: Socket) {
    const { roomId, peerId, producerId, rtpCapabilities, transportId } = data;
    try {
      const consumerData = await this.producerConsumerService.createConsumer({
        roomId,
        peerId,
        transportId,
        producerId,
        rtpCapabilities,
      });

      return {
        consumerData,
      };
    } catch (error) {
      console.error(error);
      client.emit('consume-error', { error: error.message });
    }
  }

  @SubscribeMessage('start-recording')
  async handleStartRecording(@MessageBody() data) {
    const { roomId } = data;

    // RTP 포트 설정 및 녹음 시작
    const plainTransport = await this.createPlainTransport(roomId);
    const filePath = this.startRecording(roomId, plainTransport);

    return { message: 'Recording started', filePath };
  }

  @SubscribeMessage('stop-recording')
  async handleStopRecording(@MessageBody() data) {
    const { roomId } = data;

    this.stopRecording(roomId);

    console.log('this.ffmpegProcesses', this.ffmpegProcesses);

    return { message: 'Recording stopped' };
  }
}
