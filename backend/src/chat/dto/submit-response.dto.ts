// dto/submit-response.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class SubmitResponseDto {
  @IsString()
  @IsNotEmpty()
  turnId!: string;

  @IsString()
  @IsNotEmpty()
  optionId!: string;
}