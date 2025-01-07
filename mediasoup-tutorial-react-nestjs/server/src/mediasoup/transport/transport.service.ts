import { Injectable } from '@nestjs/common';
import { RoomService } from '../room/room.service';
import { ITransportOptions } from './transport.interface';
import { PlainTransport, WebRtcTransport } from 'mediasoup/node/lib/types';
import { webRtcTransport_options } from '../media.config';

@Injectable()
export class TransportService {
  constructor(private readonly roomService: RoomService) {}

  public async createWebRtcTransport(
    roomId: string,
    peerId: string,
    direction: 'send' | 'recv',
  ): Promise<ITransportOptions> {
    const room = this.roomService.getRoom(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const transport: WebRtcTransport =
      await room.router.router.createWebRtcTransport({
        ...webRtcTransport_options,
        appData: {
          peerId,
          clientDirection: direction,
        },
      });

    this.roomService.addPeerToRoom(roomId, peerId);

    const peer = room.peers.get(peerId)!;
    peer.transports.set(transport.id, { transport });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async createPlainTransport(roomId: string) {
    const room = this.roomService.getRoom(roomId);
    // console.log('[createPlainTransport1] room.peers', room?.peers);

    const router = room.router?.router;
    const plainTransport: PlainTransport = await router?.createPlainTransport({
      listenIp: { ip: '127.0.0.1', announcedIp: null },
      // No RTP will be received from the remote side
      comedia: false,
      // FFmpeg and GStreamer don't support RTP/RTCP multiplexing ("a=rtcp-mux" in SDP)
      rtcpMux: false,
    });

    room.plainTransport = plainTransport;

    // console.log('[createPlainTransport2] room.peers', room?.peers);

    plainTransport.on('trace', (trace) => {
      console.log('RTP trace:', trace);
    });
    // console.log('plainTransport.tuple', plainTransport.tuple);
    // console.log('plainTransport.rtcpTuple', plainTransport.rtcpTuple);
    console.log(
      `PlainTransport created:
          tuple.localPort      = ${plainTransport.tuple.localPort},
          rtcpTuple.localPort  = ${plainTransport.rtcpTuple?.localPort},
          tuple.remotePort     = ${plainTransport.tuple.remotePort},
          rtcpTuple.remotePort = ${plainTransport.rtcpTuple?.remotePort}`,
    );
  }
}
