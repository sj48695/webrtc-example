import { Injectable } from '@nestjs/common';
import { Consumer } from 'mediasoup/node/lib/types';
import { RoomService } from '../room/room.service';
import { IConsumeParams, IProduceParams } from './producer-consumer.interface';

@Injectable()
export class ProducerConsumerService {
  constructor(private readonly roomService: RoomService) {}

  public async createProducer(params: IProduceParams): Promise<string> {
    const { roomId, peerId, kind, rtpParameters, transportId } = params;
    const room = this.roomService.getRoom(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer ${peerId} not found`);
    }
    const transportData = peer.transports.get(transportId);
    if (!transportData) {
      throw new Error('Transport not found');
    }

    const producer = await transportData.transport.produce({
      kind,
      rtpParameters,
    });

    peer.producers.set(producer.id, { producer });

    console.log('[createProducer] producer.id', producer.id);

    // const consumer = await room.plainTransport?.consume({
    //   producerId: producer.id,
    //   rtpCapabilities: room.router.router.rtpCapabilities,
    // });
    // // console.log('consumer', consumer);
    // // peer.consumers.set(consumer.id, { consumer });
    // room.consumers.set(consumer.id, consumer);

    // console.log('consumer.rtpParameters', consumer.rtpParameters);
    console.log(
      '[createProducer] room.peers',
      // inspect(room.peers, { depth: 4 }),
      room.peers,
    );

    return producer.id;
  }

  public async createConsumer(params: IConsumeParams): Promise<any> {
    const { roomId, peerId, producerId, rtpCapabilities, transportId } = params;
    const room = this.roomService.getRoom(roomId);

    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    if (!room.router.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error(`Cannot consume producer ${producerId}`);
    }

    const peer = room.peers.get(peerId)!;

    const transportData = peer.transports.get(transportId);
    if (!transportData) {
      throw new Error('Transport not found');
    }

    const consumer: Consumer = await transportData.transport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    peer.consumers.set(consumer.id, { consumer });

    console.log('consumer.producerId', consumer.producerId);
    console.log(
      '[createConsumer] room.peers',
      // inspect(room.peers, { depth: 4 }),
      room.peers,
    );
    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }
}
