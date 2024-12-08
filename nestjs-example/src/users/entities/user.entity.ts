import {
  BaseEntity,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Record } from '../../entities/record.entity';

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  uid: number;

  @Column({ unique: true })
  kakaoId: string;

  @Column({ unique: true })
  email: string;

  @Column()
  nickname: string;

  @Column()
  password: string;

  @OneToMany(() => Record, (record) => record.uid)
  records: Record[]; // 한 유저당 여러개의 record 생성
}
