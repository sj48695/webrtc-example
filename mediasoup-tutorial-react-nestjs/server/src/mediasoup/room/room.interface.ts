import { PlainTransport } from 'mediasoup/node/lib/PlainTransportTypes';
import { IRouter } from '../interface/media-resources.interfaces';
import { Peer } from './peer.interface';

export interface IRoom {
  id: string;
  router: IRouter;
  peers: Map<string, Peer>;
  plainTransport?: PlainTransport;
  audioPort?: number;
  audioPortRtcp?: number;
}
