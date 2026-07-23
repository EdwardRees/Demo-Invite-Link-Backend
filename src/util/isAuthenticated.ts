import jwt from 'jsonwebtoken';

const isAuthenticated = (access_token: string): string|null => {
  try {
    const id = jwt.verify(access_token, process.env.ACCESS_TOKEN_SECRET!).sub;
    return id;
  } catch(err){
    return null;
  }
}

export { isAuthenticated };
