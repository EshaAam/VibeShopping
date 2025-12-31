const Loading = () => {
  return (
    <div className='flex justify-center items-center h-screen w-full'>
      <div className='loader'>
        <p className='loader-text'>Loading</p>
        <span className='load'></span>
      </div>
    </div>
  );
};

export default Loading;