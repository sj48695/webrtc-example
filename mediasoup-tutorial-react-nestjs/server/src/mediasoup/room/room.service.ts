import { Injectable } from '@nestjs/common';
import { PlainTransport } from 'mediasoup/node/lib/PlainTransportTypes';
import { MediasoupService } from '../mediasoup.service';
import { mediaCodecs } from './../media.config';
import { IRoom } from './room.interface';

@Injectable()
export class RoomService {
  private rooms: Map<string, IRoom> = new Map();
  constructor(private readonly mediasoupService: MediasoupService) {}

  public async createRoom(roomId: string, peerId: string): Promise<IRoom> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }

    const worker = this.mediasoupService.getWorker();
    const router = await worker.createRouter({ mediaCodecs });

    const newRoom: IRoom = {
      id: roomId,
      router: { router },
      peers: new Map(),
    };
    this.rooms.set(roomId, newRoom);

    // await this.createPlainTransport(roomId, peerId);

    console.log(`>> router created for room ${roomId}`);
    return newRoom;
    // ffmpeg -loglevel debug -protocol_whitelist file,udp,rtp -buffer_size 1000000 -f sdp -i input.sdp -c:v libx264 -preset ultrafast a.mp4
    // ffmpeg -loglevel debug -protocol_whitelist file,udp,rtp -buffer_size 1000000 -f sdp -i audio.sdp -c:a libopus audio.opus

    // ffmpeg -re -i 1719796686.opus -map 0:a:0 -c:a libopus -strict -2 -f rtp rtp://127.0.0.1:5004

    // ffmpeg -re -stream_loop -1 -i 1719796686.opus -map 0:a:0 -c:a opus -f rtp rtp://127.0.0.1:5004
  }

  public getRoom(roomId: string): IRoom | undefined {
    return this.rooms.get(roomId);
  }

  public removeRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  public addPeerToRoom(roomId: string, peerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    if (!room.peers.has(peerId)) {
      room.peers.set(peerId, {
        id: peerId,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      });
    }
  }

  public removePeerFromRoom(roomId: string, peerId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.peers.delete(peerId);
    }
  }

  // async createPlainTransport(roomId: string, peerId: string) {
  //   // GStreamer's sdpdemux only supports RTCP = RTP + 1
  //   let audioPort = 5004;
  //   let audioPortRtcp = 5005;
  //   let videoPort = 5006;
  //   let videoPortRtcp = 5007;

  //   const room = this.getRoom(roomId);
  //   // const peer = room.peers.get(peerId)!;
  //   console.log('[createPlainTransport1] room.peers', room.peers);

  //   const router = room.router?.router;
  //   const plainTransport: PlainTransport = await router?.createPlainTransport({
  //     listenIp: { ip: '127.0.0.1', announcedIp: null },
  //     // No RTP will be received from the remote side
  //     comedia: false,
  //     // FFmpeg and GStreamer don't support RTP/RTCP multiplexing ("a=rtcp-mux" in SDP)
  //     rtcpMux: false,
  //   });

  //   // function getRandomPort(min = 5000, max = 6000) {
  //   //   return Math.floor(Math.random() * (max - min + 1)) + min;
  //   // }
  //   // async function allocatePortWithRetry(maxRetries = 10) {
  //   //   for (let i = 0; i < maxRetries; i++) {
  //   //     const port = getRandomPort();
  //   //     // const port = plainTransport.tuple.localPort;
  //   //     const isAvailable = await checkPortAvailability(port);
  //   //     if (isAvailable) {
  //   //       return port;
  //   //     }
  //   //     console.log(`Retry ${i + 1}/${maxRetries}: Port ${port} is in use.`);
  //   //   }
  //   //   throw new Error('Unable to allocate a port after maximum retries');
  //   // }

  //   // async function checkPortAvailability(port) {
  //   //   // audioPort = port;
  //   //   audioPort = 5004;
  //   //   audioPortRtcp = audioPort + 1;
  //   //   return await plainTransport
  //   //     .connect({
  //   //       ip: '127.0.0.1',
  //   //       port: audioPort, // FFmpeg에서 RTP 데이터를 받을 포트
  //   //       rtcpPort: audioPortRtcp, // FFmpeg에서 RTCP 데이터를 받을 포트
  //   //     })
  //   //     .then(() => {
  //   //       return true;
  //   //     })
  //   //     .catch((err) => {
  //   //       console.error('err', err);
  //   //       return false;
  //   //     });
  //   // }
  //   // allocatePortWithRetry();
  //   room.plainTransport = plainTransport;
  //   // room.audioPort = audioPort;
  //   // room.audioPortRtcp = audioPortRtcp;

  //   console.log('[createPlainTransport2] room.peers', room.peers);

  //   plainTransport.on('trace', (trace) => {
  //     console.log('RTP trace:', trace);
  //   });
  //   console.log('plainTransport.tuple', plainTransport.tuple);
  //   console.log('plainTransport.rtcpTuple', plainTransport.rtcpTuple);
  //   console.log(
  //     `PlainTransport created:
  //       tuple.localPort      = ${plainTransport.tuple.localPort},
  //       rtcpTuple.localPort  = ${plainTransport.rtcpTuple?.localPort},
  //       tuple.remotePort     = ${plainTransport.tuple.remotePort},
  //       rtcpTuple.remotePort = ${plainTransport.rtcpTuple?.remotePort},
  //       audioPort            = ${audioPort},
  //       audioPortRtcp        = ${audioPortRtcp}`,
  //   );

  //   return { plainTransport, audioPort, audioPortRtcp };
  // }
}
