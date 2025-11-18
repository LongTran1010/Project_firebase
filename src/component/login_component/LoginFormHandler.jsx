import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export function useLoginFormHandler({ auth, email, password, isRegister, setEmail, setPassword, setError, setIsRegister, emailRef }) {
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
        alert('Đăng ký thành công! Vui lòng đăng nhập lại.');
        await auth.signOut();
        setIsRegister(false);
        setEmail('');
        setPassword('');
        setError('');
        if (emailRef.current) {
          emailRef.current.focus();
        }
        return;
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      let code = err.code || '';
      let message = '';
      if (err.message && err.message.includes('auth/invalid-credential')) {
        message = 'Email hoặc mật khẩu không đúng.';
      } else {
        if (!code && err.message) {
          const match = err.message.match(/auth\/(\w+-?\w*)/);
          if (match) code = `auth/${match[1]}`;
        }
        if (code === 'auth/invalid-email') {
          message = 'Email không hợp lệ.';
        } else if (
          code === 'auth/user-not-found' ||
          code === 'auth/wrong-password' ||
          code === 'auth/invalid-credential'
        ) {
          message = 'Email hoặc mật khẩu không đúng.';
        } else if (code === 'auth/email-already-in-use') {
          message = 'Email đã được sử dụng.';
        } else if (code === 'auth/weak-password') {
          message = 'Mật khẩu quá yếu. Vui lòng nhập mật khẩu mạnh hơn.';
        } else {
          message = 'Đã xảy ra lỗi. Vui lòng thử lại.';
        }
      }
      setError(message);
      setEmail('');
      setPassword('');
      if (emailRef.current) {
        emailRef.current.focus();
      }
    }
  };
  return handleSubmit;
}
