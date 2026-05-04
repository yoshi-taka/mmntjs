function each(array, callback) {
    let i;
    for (i = 0; i < array.length; i++) {
        callback(array[i], i, array);
    }
}

export default each;
