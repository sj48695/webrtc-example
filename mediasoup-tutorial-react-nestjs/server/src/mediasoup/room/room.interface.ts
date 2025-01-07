import { PlainTransport } from 'mediasoup/node/lib/PlainTransportTypes';
import { IRouter } from '../interface/media-resources.interfaces';
import { Peer } from './peer.interface';
import { Consumer } from 'mediasoup/node/lib/ConsumerTypes';

export interface IRoom {
  id: string;
  router: IRouter;
  peers: Map<string, Peer>;
  plainTransport?: PlainTransport;
  consumers: Map<string, Consumer>;
}
