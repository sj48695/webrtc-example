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
import { spawn } from 'child_process';
import * as fs from 'fs';
import { Consumer } from 'mediasoup/node/lib/ConsumerTypes';
import * as path from 'path';
import { Server, Socket } from 'socket.io';
import { ProducerConsumerService } from 'src/mediasoup/producer-consumer/producer-consumer.service';
import { RoomService } from 'src/mediasoup/room/room.service';
import { TransportService } from 'src/mediasoup/transport/transport.service';
import { inspect } from 'util';
import { JoinChannelDto } from './dto/join-channel.dto';

@WebSocketGateway({
  cors: true,
  // cors: {
  //   origin: 'https://192.168.35.25:3002',
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

  async startRecordingFfmpeg({ roomId, peerId }) {
    const room = this.roomService.getRoom(roomId);
    const peer = room?.peers?.get(peerId);

    if (!room.plainTransport) {
      await this.transportService.createPlainTransport(roomId);
    }

    const recordingsPath = path.resolve(__dirname, '../recordings');
    console.log('Recordings path:', recordingsPath);
    if (!fs.existsSync(recordingsPath)) {
      fs.mkdirSync(recordingsPath, { recursive: true });
    }

    const getCodecInfo = (
      kind,
      {
        preferredPayloadType,
        payloadType,
        mimeType,
        clockRate,
        channels,
      }: any = {},
    ) => {
      return {
        payloadType: payloadType || preferredPayloadType,
        codecName: mimeType?.replace(`${kind}/`, ''),
        clockRate: clockRate,
        channels: kind === 'audio' ? channels : undefined,
      };
    };

    const createSdpText = (rtpParameters) => {
      const {
        // video,
        audio,
      } = rtpParameters;

      // const videoCodecInfo = getCodecInfo('video', video?.routerCodec);
      const audioCodecInfo = getCodecInfo('audio', audio?.routerCodec);

      return (
        `v=0
o=- 0 0 IN IP4 127.0.0.1
s=FFmpeg
c=IN IP4 127.0.0.1
t=0 0` +
        // `
        // m=video ${video?.remoteRtpPort} RTP/AVP ${videoCodecInfo?.payloadType}
        // a=rtpmap:${videoCodecInfo?.payloadType} ${videoCodecInfo?.codecName}/${videoCodecInfo?.clockRate}
        // a=sendonly
        // ` +
        `
m=audio ${audio?.remoteRtpPort} RTP/AVP ${audioCodecInfo?.payloadType}
a=rtcp:${audio?.remoteRtpPort + 1}
a=rtpmap:${audioCodecInfo?.payloadType} ${audioCodecInfo?.codecName}/${audioCodecInfo?.clockRate}/${audioCodecInfo?.channels}
a=recvonly
`
      );
    };

    const publishProducerRtpStream = async (peer, producer) => {
      let remoteRtpPort = 5004;

      function getRandomPort(min = 5000, max = 6000) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }
      async function allocatePortWithRetry(maxRetries = 5) {
        const { rtpPort }: { rtpPort?: number } = room.plainTransport.appData;
        if (room.plainTransport.appData.connected) {
          console.log(
            `PlainTransport is already connected to RTP=${rtpPort}, RTCP=${
              rtpPort + 1
            }`,
          );
          return;
        }
        for (let i = 0; i < maxRetries; i++) {
          const port = getRandomPort();
          // const port = plainTransport.tuple.localPort;
          const isAvailable = await checkPortAvailability(port);
          if (isAvailable) {
            return port;
          }
          console.log(`Retry ${i + 1}/${maxRetries}: Port ${port} is in use.`);
        }
        throw new Error('Unable to allocate a port after maximum retries');
      }

      async function checkPortAvailability(port) {
        remoteRtpPort = port;

        return await room.plainTransport
          .connect({
            ip: '127.0.0.1',
            port: remoteRtpPort, // FFmpeg에서 RTP 데이터를 받을 포트
            rtcpPort: remoteRtpPort + 1, // FFmpeg에서 RTCP 데이터를 받을 포트
          })
          .then(() => {
            room.plainTransport.appData.rtpPort = remoteRtpPort;
            room.plainTransport.appData.connected = true; // 연결 상태 저장
            return true;
          })
          .catch((err) => {
            console.error('err', err);
            return false;
          });
      }
      await allocatePortWithRetry();

      // const codecs = [];
      // Codec passed to the RTP Consumer must match the codec in the Mediasoup router rtpCapabilities
      const routerCodec = room.router.router.rtpCapabilities.codecs.find(
        (codec) => codec.kind === producer.kind,
      );
      // console.log('routerCodec', inspect(routerCodec, { depth: 10 }));
      // codecs.push(routerCodec);

      // const rtpCapabilities = {
      //   codecs,
      //   rtcpFeedback: [],
      // };

      console.log('[publishProducerRtpStream] producer.id', producer.id);

      // Start the consumer paused
      // Once the gstreamer process is ready to consume resume and send a keyframe
      const rtpConsumer = await room.plainTransport.consume({
        producerId: producer.id,
        rtpCapabilities: room.router.router.rtpCapabilities,
        // rtpCapabilities,
        // paused: true,
      });

      room.plainTransport.appData.consumers ||= new Map();
      (room.plainTransport.appData.consumers as Map<string, Consumer>).set(
        rtpConsumer.id,
        rtpConsumer,
      );

      // peer.consumers.set(rtpConsumer.id, { consumer: rtpConsumer });

      return {
        remoteRtpPort,
        routerCodec,
      };
    };

    const recordInfo = {};
    for (const producer of peer?.producers?.values() || []) {
      recordInfo[producer.producer.kind] = await publishProducerRtpStream(
        peer,
        producer.producer,
      );
    }

    console.log(
      'room.plainTransport.appData.consumers',
      room.plainTransport.appData.consumers,
    );
    console.log('recordInfo', inspect(recordInfo, { depth: 10 }));
    const sdpPath = path.join(recordingsPath, `${roomId}-input-vp8.sdp`);
    const sdp = createSdpText(recordInfo);
    fs.writeFileSync(sdpPath, sdp, 'utf8');

    // let cmdOutputPath = `${__dirname}/recording/output-ffmpeg-vp8.m4a`;
    const cmdOutputPath = path.join(
      recordingsPath,
      `${roomId}-${peerId}-output-ffmpeg-vp8.m4a`,
    );
    // // 빈 파일 생성
    // fs.writeFileSync(cmdOutputPath, '', 'utf8'); // 빈 문자열로 파일 생성

    if (this.ffmpegProcesses[roomId]) {
      console.log(`Recording already in progress for room ${roomId}`);
      return;
    }

    const ffmpeg = spawn('ffmpeg', [
      ...['-loglevel', 'debug'],
      '-nostdin', // FFmpeg가 표준 입력을 대기하지 않도록 설정.
      ...['-protocol_whitelist', 'file,udp,rtp'],
      ...['-buffer_size', '1000000'], // UDP 버퍼 크기 증가
      ...['-fflags', '+genpts'],
      ...[...['-f', 'sdp'], ...['-i', sdpPath]],
      ...['-map', '0:a:0'],
      ...['-c:a', 'aac'],
      ...['-b:a', '192k'],
      ...['-preset', 'ultrafast'],
      ...['-y', cmdOutputPath],
    ]);

    console.log('FFmpeg command:', ffmpeg.spawnargs.join(' '));

    this.ffmpegProcesses[roomId] = ffmpeg;

    ffmpeg.stdout.on('data', (data) => console.log(`FFmpeg output: ${data}`));
    // ffmpeg.stderr.on('data', (data) => console.error(`FFmpeg error: ${data}`));

    // FFmpeg writes its logs to stderr
    ffmpeg.stderr.on('data', (chunk) => {
      chunk
        .toString()
        .split(/\r?\n/g)
        .filter(Boolean) // Filter out empty strings
        .forEach((line) => {
          console.log(line);
        });
    });

    ffmpeg.on('error', (err) => {
      console.error('Recording process error:', err);
    });

    ffmpeg.on('exit', (code, signal) => {
      console.log('Recording process exit, code: %d, signal: %s', code, signal);

      if (!signal || signal === 'SIGINT') {
        console.log('Recording stopped');
      } else {
        console.warn(
          "Recording process didn't exit cleanly, output file might be corrupt",
        );
      }
    });

    ffmpeg.on('close', (code) => {
      console.log(`FFmpeg process exited with code ${code}`);

      const ffmpegProcess = this.ffmpegProcesses[roomId];
      if (ffmpegProcess) {
        ffmpegProcess.kill('SIGINT'); // SIGINT로 프로세스 종료
        delete this.ffmpegProcesses[roomId];
      }
    });
  }

  // 녹음 종료 함수
  async stopRecording(roomId: string) {
    const ffmpegProcess = this.ffmpegProcesses[roomId];

    if (ffmpegProcess) {
      const room = this.roomService.getRoom(roomId);
      console.log('[stopRecording1] room', room);
      console.log('[stopRecording1] room.peers', room?.peers);
      ffmpegProcess.kill('SIGINT'); // SIGINT로 프로세스 종료
      delete this.ffmpegProcesses[roomId];
      console.log(`Stopped recording for room: ${roomId}`);

      // // Consumers 일괄 종료
      // for (const consumer of (
      //   room?.plainTransport?.appData?.consumers as Map<string, Consumer>
      // ).values()) {
      //   consumer.close();
      // }
      // room.plainTransport.appData.consumers = null;
      // // for (const consumer of room?.consumers?.values()) {
      // //   consumer.close();
      // // }
      // // room.consumers = null;
      // room.plainTransport.close();
      // room.plainTransport = null;
      console.log('[stopRecording2] room', room);
      console.log('[stopRecording2] room.peers', room?.peers);

      const recordingsPath = path.resolve(__dirname, '../recordings');
      console.log('Recordings path:', recordingsPath);
      // 반환할 파일 경로 (녹음 파일)
      const outputPath = path.join(recordingsPath, `${roomId}.m4a`);
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

      // console.log('sendTransportOptions', sendTransportOptions);
      const recvTransportOptions =
        await this.transportService.createWebRtcTransport(
          roomId,
          peerId,
          'recv',
        );

      // console.log('recvTransportOptions', recvTransportOptions);
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

      if (newRoom) {
        client.emit('new-room');
      }

      return {
        sendTransportOptions,
        recvTransportOptions,
        rtpCapabilities: room.router.router.rtpCapabilities,
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
  async handleConnectTransport(@MessageBody() data) {
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

      console.log('producerId', producerId);

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
  async handleStartRecording(
    @MessageBody() data,
    // @ConnectedSocket() client: Socket,
  ) {
    const { roomId, peerId } = data;

    const filePath = await this.startRecordingFfmpeg({ roomId, peerId });

    return { message: 'Recording started', filePath };
  }

  @SubscribeMessage('stop-recording')
  async handleStopRecording(
    @MessageBody() data,
    // @ConnectedSocket() client: Socket,
  ) {
    const { roomId } = data;

    await this.stopRecording(roomId);

    console.log('this.ffmpegProcesses', this.ffmpegProcesses);

    return { message: 'Recording stopped' };
  }
}
