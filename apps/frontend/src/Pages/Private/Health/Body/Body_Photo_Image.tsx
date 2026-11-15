import { BASE_URL } from '../../../../config/urls';
import { End_Points } from '../../../../Service/endPoints';
import type { ProgressPhoto } from '../../../../Hooks/Health/healthLogTypes';

interface Body_Photo_Image_Props {
  photo: ProgressPhoto;
  alt: string;
}

const Body_Photo_Image = ({ photo, alt }: Body_Photo_Image_Props) => {
  const url = `${BASE_URL}${End_Points.Health_Body_Photo_By_Id_Endpoint(photo.id)}`;

  return (
    <a className='Body_Photo_Image' href={url} target='_blank' rel='noreferrer'>
      <img src={url} alt={alt} loading='lazy' />
    </a>
  );
};

export default Body_Photo_Image;
