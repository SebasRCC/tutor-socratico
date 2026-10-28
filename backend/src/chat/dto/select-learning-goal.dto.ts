// dto/select-learning-goal.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class SelectLearningGoalDto {
  @IsString()
  @IsNotEmpty()
  topicId!: string;

  @IsString()
  @IsNotEmpty()
  objectiveId!: string;
}